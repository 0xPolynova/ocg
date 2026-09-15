import BN from "bn.js";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const PUMP_ALT_MAINNET = new PublicKey("7mFD2mUtRS65XstiSAvCJuYmdesZoQwCwRJhq1p3eRMe");

const CREATE_AND_BUY_COMPUTE_UNITS = 390_000;
const CREATE_ONLY_COMPUTE_UNITS = 270_000;
const PRIORITY_MICRO_LAMPORTS = 100_000;

export function compactMetadataUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed || trimmed.startsWith("data:")) {
    throw new Error("Could not pin metadata to IPFS. Try launching again.");
  }
  const cid = trimmed.match(/\/ipfs\/([a-zA-Z0-9]+)/)?.[1];
  if (cid && cid.length >= 46) {
    const short = `https://ipfs.io/ipfs/${cid}`;
    if (short.length <= trimmed.length) return short;
  }
  return trimmed;
}

function budgetInstructions(computeUnits: number): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICRO_LAMPORTS }),
  ];
}

async function fetchPumpAlt(connection: Connection): Promise<AddressLookupTableAccount> {
  const { value } = await connection.getAddressLookupTable(PUMP_ALT_MAINNET);
  if (!value) throw new Error("Pump.fun address lookup table is missing on this RPC.");
  return value;
}

export async function buildPumpCreateInstructions(args: {
  connection: Connection;
  user: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  solBuy: number;
  mayhemMode?: boolean;
}): Promise<{ instructions: TransactionInstruction[]; tokenAmount: BN; solLamports: BN }> {
  const { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } = await import("@pump-fun/pump-sdk");
  const sdk = new OnlinePumpSdk(args.connection);
  const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig()]);
  const name = args.name.slice(0, 32);
  const symbol = args.symbol.slice(0, 10);
  const uri = compactMetadataUri(args.uri);
  const mayhemMode = args.mayhemMode ?? false;
  const solLamports = new BN(Math.max(0, Math.round(args.solBuy * 1_000_000_000)));

  if (solLamports.lten(0)) {
    return {
      instructions: [
        ...budgetInstructions(CREATE_ONLY_COMPUTE_UNITS),
        await PUMP_SDK.createV2Instruction({
          mint: args.mint,
          name,
          symbol,
          uri,
          creator: args.user,
          user: args.user,
          mayhemMode,
        }),
      ],
      tokenAmount: new BN(0),
      solLamports,
    };
  }

  const tokenAmount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: null,
    bondingCurve: null,
    amount: solLamports,
    quoteMint: NATIVE_MINT,
  });
  if (tokenAmount.lten(0)) {
    throw new Error("Dev buy is too small for the Pump.fun curve.");
  }

  const createAndBuy = await PUMP_SDK.createV2AndBuyInstructions({
    global,
    mint: args.mint,
    name,
    symbol,
    uri,
    creator: args.user,
    user: args.user,
    amount: tokenAmount,
    solAmount: solLamports,
    mayhemMode,
  });

  return {
    instructions: [...budgetInstructions(CREATE_AND_BUY_COMPUTE_UNITS), ...createAndBuy],
    tokenAmount,
    solLamports,
  };
}

export async function buildMintSignedPumpCreateTx(args: {
  connection: Connection;
  user: PublicKey;
  mintKeypair: Keypair;
  name: string;
  symbol: string;
  uri: string;
  solBuy: number;
  mayhemMode?: boolean;
}): Promise<{
  transaction: VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
  tokenAmount: BN;
  solLamports: BN;
}> {
  const { instructions, tokenAmount, solLamports } = await buildPumpCreateInstructions({
    connection: args.connection,
    user: args.user,
    mint: args.mintKeypair.publicKey,
    name: args.name,
    symbol: args.symbol,
    uri: args.uri,
    solBuy: args.solBuy,
    mayhemMode: args.mayhemMode,
  });

  const pumpIxs = instructions.filter((ix) => ix.programId.equals(PUMP_PROGRAM_ID));
  if (solLamports.gtn(0) && pumpIxs.length < 2) {
    throw new Error("Pump create+buy did not include the first buy.");
  }

  const alt = await fetchPumpAlt(args.connection);
  const { blockhash, lastValidBlockHeight } = await args.connection.getLatestBlockhash("finalized");
  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: args.user,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message([alt]),
  );
  transaction.sign([args.mintKeypair]);

  const sim = await args.connection.simulateTransaction(transaction, {
    sigVerify: false,
    replaceRecentBlockhash: false,
    commitment: "processed",
  });
  if (sim.value.err) {
    const logs = sim.value.logs?.slice(-12).join("\n") ?? JSON.stringify(sim.value.err);
    throw new Error(`Pump create simulation failed: ${logs}`);
  }

  return { transaction, blockhash, lastValidBlockHeight, tokenAmount, solLamports };
}

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
const COMPUTE_BUDGET_PROGRAM = new PublicKey("ComputeBudget111111111111111111111111111111");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const PROGRAM_NAMES: Record<string, string> = {
  [COMPUTE_BUDGET_PROGRAM.toBase58()]: "ComputeBudget",
  [PUMP_PROGRAM_ID.toBase58()]: "Pump.fun",
  [ASSOCIATED_TOKEN_PROGRAM.toBase58()]: "AssociatedToken",
  [TOKEN_2022_PROGRAM.toBase58()]: "Token-2022",
  [PublicKey.default.toBase58()]: "System",
  "11111111111111111111111111111111": "System",
};

export type PumpSimReport = {
  ok: boolean;
  label: string;
  err: unknown;
  unitsConsumed: number | null;
  logs: string[];
  innerInstructionCount: number;
  size: number;
  sizeWithoutAlt: number | null;
  version: number | "legacy";
  numRequiredSignatures: number;
  signaturesPresent: number;
  feePayerSigned: boolean;
  mintSigned: boolean;
  payer: string;
  blockhash: string;
  lookupTables: string[];
  lookupWritable: number;
  lookupReadonly: number;
  staticAccountCount: number;
  programs: string[];
  instructionCount: number;
};

function sigFilled(signature: Uint8Array): boolean {
  return signature.some((byte) => byte !== 0);
}

function programLabel(id: string): string {
  return PROGRAM_NAMES[id] ?? id;
}

export function inspectPumpTx(transaction: VersionedTransaction): Omit<
  PumpSimReport,
  "ok" | "label" | "err" | "unitsConsumed" | "logs" | "innerInstructionCount" | "sizeWithoutAlt"
> {
  const message = transaction.message;
  const lookups = "addressTableLookups" in message ? message.addressTableLookups : [];
  const compiled = "compiledInstructions" in message ? message.compiledInstructions : [];
  const staticKeys = "staticAccountKeys" in message ? message.staticAccountKeys : [];
  const programs = compiled.map((ix) => {
    const id = staticKeys[ix.programIdIndex]?.toBase58();
    return id ? programLabel(id) : `account[${ix.programIdIndex}]`;
  });
  return {
    size: transaction.serialize().length,
    version: transaction.version,
    numRequiredSignatures: message.header.numRequiredSignatures,
    signaturesPresent: transaction.signatures.filter(sigFilled).length,
    feePayerSigned: Boolean(transaction.signatures[0] && sigFilled(transaction.signatures[0])),
    mintSigned: Boolean(transaction.signatures[1] && sigFilled(transaction.signatures[1])),
    payer: staticKeys[0]?.toBase58() ?? "",
    blockhash: message.recentBlockhash,
    lookupTables: lookups.map((item) => item.accountKey.toBase58()),
    lookupWritable: lookups.reduce((sum, item) => sum + item.writableIndexes.length, 0),
    lookupReadonly: lookups.reduce((sum, item) => sum + item.readonlyIndexes.length, 0),
    staticAccountCount: staticKeys.length,
    programs,
    instructionCount: compiled.length,
  };
}

export function logPumpSim(report: PumpSimReport): void {
  const banner = `[OCG pump] ${report.label} ${report.ok ? "OK" : "FAILED"} · ${report.size}B · ${report.unitsConsumed ?? "?"} CU`;
  if (report.ok) console.info(banner, report);
  else console.error(banner, report);
  if (report.logs.length) {
    console[report.ok ? "info" : "error"](`[OCG pump] ${report.label} logs\n${report.logs.join("\n")}`);
  }
}

export async function simulatePumpTxVerbose(args: {
  connection: Connection;
  transaction: VersionedTransaction;
  label: string;
  sigVerify?: boolean;
  sizeWithoutAlt?: number | null;
}): Promise<PumpSimReport> {
  const inspected = inspectPumpTx(args.transaction);
  const sim = await args.connection.simulateTransaction(args.transaction, {
    sigVerify: args.sigVerify ?? false,
    replaceRecentBlockhash: false,
    commitment: "confirmed",
    innerInstructions: true,
  });
  const report: PumpSimReport = {
    ...inspected,
    ok: !sim.value.err,
    label: args.label,
    err: sim.value.err,
    unitsConsumed: sim.value.unitsConsumed ?? null,
    logs: sim.value.logs ?? [],
    innerInstructionCount: sim.value.innerInstructions?.length ?? 0,
    sizeWithoutAlt: args.sizeWithoutAlt ?? null,
  };
  logPumpSim(report);
  return report;
}

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
    cashback: false,
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
  simulation: PumpSimReport;
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
  const message = new TransactionMessage({
    payerKey: args.user,
    recentBlockhash: blockhash,
    instructions,
  });
  const withoutAlt = new VersionedTransaction(message.compileToV0Message());
  withoutAlt.sign([args.mintKeypair]);
  const transaction = new VersionedTransaction(message.compileToV0Message([alt]));
  transaction.sign([args.mintKeypair]);

  const simulation = await simulatePumpTxVerbose({
    connection: args.connection,
    transaction,
    label: "server Helius (mint-signed, wallet unsigned)",
    sigVerify: false,
    sizeWithoutAlt: withoutAlt.serialize().length,
  });
  if (!simulation.ok) {
    const logs = simulation.logs.slice(-20).join("\n") || JSON.stringify(simulation.err);
    throw new Error(`Pump create simulation failed: ${logs}`);
  }

  return { transaction, blockhash, lastValidBlockHeight, tokenAmount, solLamports, simulation };
}

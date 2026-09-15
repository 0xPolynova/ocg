import BN from "bn.js";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import type { SendTransactionOptions } from "@solana/wallet-adapter-base";
import { NATIVE_MINT } from "@solana/spl-token";

import { apiUrl } from "@/lib/api";
import type { PumpCoinStats } from "@/lib/types";

type WalletSender = {
  publicKey: PublicKey | null;
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions,
  ) => Promise<string>;
};

export async function uploadPumpMetadata(args: {
  name: string;
  symbol: string;
  description: string;
  image?: File | null;
  website?: string;
  twitter?: string;
  telegram?: string;
}): Promise<string> {
  const body = new FormData();
  if (args.image) body.append("file", args.image);
  body.append("name", args.name);
  body.append("symbol", args.symbol);
  body.append("description", args.description);
  body.append("twitter", args.twitter ?? "");
  body.append("telegram", args.telegram ?? "");
  body.append("website", args.website ?? "");
  body.append("showName", "true");

  const response = await fetch(apiUrl("/api/ipfs"), { method: "POST", body });
  const json = (await response.json()) as { uri?: string; metadataUri?: string; error?: string };
  if (!response.ok || (!json.uri && !json.metadataUri)) {
    throw new Error(json.error ?? "Could not upload token metadata.");
  }
  return json.uri ?? json.metadataUri ?? "";
}

export async function createPumpToken(args: {
  connection: Connection;
  wallet: WalletSender;
  name: string;
  symbol: string;
  uri: string;
  solBuy: number;
  mayhemMode?: boolean;
  mintKeypair?: Keypair;
}): Promise<{ mint: PublicKey; mintKeypair: Keypair; signature: string }> {
  if (!args.wallet.publicKey) throw new Error("Connect a wallet first.");

  const [{ OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount }, { ComputeBudgetProgram }] =
    await Promise.all([import("@pump-fun/pump-sdk"), import("@solana/web3.js")]);

  const mintKeypair = args.mintKeypair ?? Keypair.generate();
  const user = args.wallet.publicKey;
  const sdk = new OnlinePumpSdk(args.connection);
  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();
  const mayhemMode = args.mayhemMode ?? false;

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }));

  if (args.solBuy > 0) {
    const solAmount = new BN(Math.round(args.solBuy * 1_000_000_000));
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: null,
      bondingCurve: null,
      amount: solAmount,
      quoteMint: NATIVE_MINT,
    });
    const ixs = await PUMP_SDK.createV2AndBuyInstructions({
      global,
      mint: mintKeypair.publicKey,
      name: args.name,
      symbol: args.symbol,
      uri: args.uri,
      creator: user,
      user,
      amount,
      solAmount,
      mayhemMode,
    });
    tx.add(...ixs);
  } else {
    tx.add(
      await PUMP_SDK.createV2Instruction({
        mint: mintKeypair.publicKey,
        name: args.name,
        symbol: args.symbol,
        uri: args.uri,
        creator: user,
        user,
        mayhemMode,
      }),
    );
  }

  const signature = await args.wallet.sendTransaction(tx, args.connection, {
    signers: [mintKeypair],
  });
  const latest = await args.connection.getLatestBlockhash("confirmed");
  await args.connection.confirmTransaction(
    { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed",
  );

  return { mint: mintKeypair.publicKey, mintKeypair, signature };
}

export async function fetchPumpStats(mint: string): Promise<PumpCoinStats | null> {
  try {
    const response = await fetch(apiUrl(`/api/pump/${mint}`));
    if (!response.ok) return null;
    return (await response.json()) as PumpCoinStats;
  } catch {
    return null;
  }
}

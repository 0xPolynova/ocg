import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import type { SendTransactionOptions } from "@solana/wallet-adapter-base";
import { NATIVE_MINT } from "@solana/spl-token";

import { apiUrl } from "@/lib/api";
import type { PumpCoinStats } from "@/lib/types";

type WalletSender = {
  publicKey: PublicKey | null;
  sendTransaction: (
    transaction: VersionedTransaction,
    connection: Connection,
    options?: SendTransactionOptions,
  ) => Promise<string>;
};

function compactMetadataUri(uri: string): string {
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
  body.append("name", args.name.slice(0, 32));
  body.append("symbol", args.symbol.slice(0, 10));
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
  return compactMetadataUri(json.uri ?? json.metadataUri ?? "");
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

  const { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } = await import("@pump-fun/pump-sdk");

  const mintKeypair = args.mintKeypair ?? Keypair.generate();
  const user = args.wallet.publicKey;
  const name = args.name.slice(0, 32);
  const symbol = args.symbol.slice(0, 10);
  const uri = compactMetadataUri(args.uri);
  const mayhemMode = args.mayhemMode ?? false;
  const sdk = new OnlinePumpSdk(args.connection);
  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();

  const instructions =
    args.solBuy > 0
      ? await PUMP_SDK.createV2AndBuyInstructions({
          global,
          mint: mintKeypair.publicKey,
          name,
          symbol,
          uri,
          creator: user,
          user,
          amount: getBuyTokenAmountFromSolAmount({
            global,
            feeConfig,
            mintSupply: null,
            bondingCurve: null,
            amount: new BN(Math.round(args.solBuy * 1_000_000_000)),
            quoteMint: NATIVE_MINT,
          }),
          solAmount: new BN(Math.round(args.solBuy * 1_000_000_000)),
          mayhemMode,
        })
      : [
          await PUMP_SDK.createV2Instruction({
            mint: mintKeypair.publicKey,
            name,
            symbol,
            uri,
            creator: user,
            user,
            mayhemMode,
          }),
        ];

  const { blockhash, lastValidBlockHeight } = await args.connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(),
  );
  tx.sign([mintKeypair]);

  const signature = await args.wallet.sendTransaction(tx, args.connection, {
    signers: [mintKeypair],
  });
  await args.connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
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

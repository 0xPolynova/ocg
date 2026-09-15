import {
  Connection,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import type { SendTransactionOptions } from "@solana/wallet-adapter-base";

import { apiUrl } from "@/lib/api";
import { HELIUS_RPC_HTTP } from "@/lib/solana-rpc";
import type { PumpCoinStats } from "@/lib/types";

type WalletSender = {
  publicKey: PublicKey | null;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  sendTransaction: (
    transaction: VersionedTransaction,
    connection: Connection,
    options?: SendTransactionOptions,
  ) => Promise<string>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function waitForSignature(connection: Connection, signature: string, lastValidBlockHeight: number): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value[0];
    if (status?.err) throw new Error("Pump.fun rejected the create transaction.");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    const height = await connection.getBlockHeight("confirmed");
    if (height > lastValidBlockHeight) {
      const again = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
      if (again.value[0]?.err) throw new Error("Pump.fun rejected the create transaction.");
      return;
    }
    await sleep(1000);
  }
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
  const json = (await response.json()) as { uri?: string; metadataUri?: string; error?: string; fallback?: boolean };
  if (!response.ok || (!json.uri && !json.metadataUri)) {
    throw new Error(json.error ?? "Could not upload token metadata.");
  }
  return compactMetadataUri(json.uri ?? json.metadataUri ?? "");
}

export async function createPumpToken(args: {
  wallet: WalletSender;
  name: string;
  symbol: string;
  uri: string;
  solBuy: number;
  mayhemMode?: boolean;
  mintSecretKey: Uint8Array;
}): Promise<{ mint: PublicKey; signature: string }> {
  if (!args.wallet.publicKey) throw new Error("Connect a wallet first.");

  const response = await fetch(apiUrl("/api/pump/create-tx"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: args.wallet.publicKey.toBase58(),
      name: args.name,
      symbol: args.symbol,
      uri: args.uri,
      solBuy: args.solBuy,
      mayhemMode: args.mayhemMode ?? false,
      mintSecretKey: Array.from(args.mintSecretKey),
    }),
  });
  const json = (await response.json()) as {
    transaction?: string;
    mint?: string;
    lastValidBlockHeight?: number;
    error?: string;
  };
  if (!response.ok || !json.transaction || !json.mint || json.lastValidBlockHeight == null) {
    throw new Error(json.error ?? "Could not build the Pump.fun create transaction.");
  }

  const tx = VersionedTransaction.deserialize(bytesFromBase64(json.transaction));
  const sender = new Connection(HELIUS_RPC_HTTP, { commitment: "confirmed" });
  const signature = await args.wallet.sendTransaction(tx, sender, {
    skipPreflight: true,
    maxRetries: 8,
    preflightCommitment: "confirmed",
  });
  await waitForSignature(sender, signature, json.lastValidBlockHeight);
  return { mint: new PublicKey(json.mint), signature };
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

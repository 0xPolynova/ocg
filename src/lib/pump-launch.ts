import type { Adapter, StandardWalletAdapter } from "@solana/wallet-adapter-base";
import { SolanaSignTransaction, type SolanaSignTransactionFeature } from "@solana/wallet-standard-features";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

import { apiUrl } from "@/lib/api";
import {
  inspectPumpTx,
  logPumpSim,
  simulatePumpTxVerbose,
  type PumpSimReport,
} from "@/lib/pump-create-tx";
import { HELIUS_RPC_HTTP } from "@/lib/solana-rpc";
import type { PumpCoinStats } from "@/lib/types";

type WalletSender = {
  publicKey: PublicKey | null;
  wallet?: { adapter: Adapter } | null;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
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

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isStandardAdapter(adapter: Adapter | undefined | null): adapter is StandardWalletAdapter {
  return Boolean(adapter && "standard" in adapter && adapter.standard === true && "wallet" in adapter);
}

async function signMainnetVersionedTx(args: {
  adapter?: Adapter | null;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  transaction: VersionedTransaction;
}): Promise<VersionedTransaction> {
  if (isStandardAdapter(args.adapter)) {
    const std = args.adapter.wallet;
    const account = std.accounts[0];
    if (!account) throw new Error("Connect a wallet first.");
    if (!(SolanaSignTransaction in std.features)) {
      throw new Error("Wallet cannot sign this Pump.fun transaction.");
    }
    console.info("[OCG pump] signing via wallet-standard solana:signTransaction chain=solana:mainnet");
    const [output] = await (std.features as SolanaSignTransactionFeature)[SolanaSignTransaction].signTransaction({
      account,
      chain: "solana:mainnet",
      transaction: args.transaction.serialize(),
    });
    if (!output?.signedTransaction?.length) throw new Error("Wallet returned an empty transaction.");
    return VersionedTransaction.deserialize(output.signedTransaction);
  }
  if (!args.signTransaction) throw new Error("Wallet cannot sign this Pump.fun transaction.");
  console.info("[OCG pump] signing via adapter.signTransaction (no explicit chain)");
  return args.signTransaction(args.transaction);
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
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
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
    buyLamports?: string;
    buyTokens?: string;
    simulation?: PumpSimReport;
    error?: string;
  };
  if (json.simulation) logPumpSim({ ...json.simulation, label: json.simulation.label || "API simulation" });
  if (!response.ok || !json.transaction || !json.mint || json.lastValidBlockHeight == null) {
    throw new Error(json.error ?? "Could not build the Pump.fun create transaction.");
  }

  const tx = VersionedTransaction.deserialize(bytesFromBase64(json.transaction));
  const before = inspectPumpTx(tx);
  console.info("[OCG pump] deserialized mint-signed tx", {
    mint: json.mint,
    buyLamports: json.buyLamports,
    buyTokens: json.buyTokens,
    ...before,
  });
  if (!before.mintSigned) {
    throw new Error("Create transaction is missing the mint signature.");
  }

  const connection = new Connection(HELIUS_RPC_HTTP, { commitment: "confirmed" });
  const clientSim = await simulatePumpTxVerbose({
    connection,
    transaction: tx,
    label: "browser Helius before wallet sign",
    sigVerify: false,
    sizeWithoutAlt: json.simulation?.sizeWithoutAlt ?? null,
  });
  if (!clientSim.ok) {
    throw new Error(
      `Pump create simulation failed before signing: ${clientSim.logs.slice(-20).join("\n") || JSON.stringify(clientSim.err)}`,
    );
  }

  const signed = await signMainnetVersionedTx({
    adapter: args.wallet.wallet?.adapter,
    signTransaction: args.wallet.signTransaction,
    transaction: tx,
  });
  const afterSign = inspectPumpTx(signed);
  console.info("[OCG pump] wallet-signed tx", afterSign);
  if (!afterSign.feePayerSigned) {
    throw new Error("Wallet did not sign the Pump.fun transaction.");
  }
  if (!afterSign.mintSigned) {
    throw new Error("Wallet dropped the mint signature. Phantom must keep the extra signer.");
  }

  const signedSim = await simulatePumpTxVerbose({
    connection,
    transaction: signed,
    label: "browser Helius after wallet sign (sigVerify)",
    sigVerify: true,
    sizeWithoutAlt: json.simulation?.sizeWithoutAlt ?? null,
  });
  if (!signedSim.ok) {
    throw new Error(
      `Pump create simulation failed after signing: ${signedSim.logs.slice(-20).join("\n") || JSON.stringify(signedSim.err)}`,
    );
  }

  const raw = signed.serialize();
  console.info("[OCG pump] sending raw tx via Helius, skipPreflight", { bytes: raw.length });
  let signature: string;
  try {
    signature = await connection.sendRawTransaction(raw, {
      skipPreflight: true,
      maxRetries: 8,
      preflightCommitment: "confirmed",
    });
  } catch (error) {
    console.error("[OCG pump] Helius sendRawTransaction failed", error);
    throw error instanceof Error ? error : new Error("Could not send the Pump.fun transaction.");
  }
  console.info("[OCG pump] submitted", signature);
  await waitForSignature(connection, signature, json.lastValidBlockHeight);
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

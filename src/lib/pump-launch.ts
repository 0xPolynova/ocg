import type { Adapter, StandardWalletAdapter } from "@solana/wallet-adapter-base";
import { SolanaSignTransaction, type SolanaSignTransactionFeature } from "@solana/wallet-standard-features";
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";

import { apiUrl } from "@/lib/api";
import {
  inspectPumpTx,
  logPumpSim,
  simulatePumpTxVerbose,
  type PumpSimReport,
} from "@/lib/pump-create-tx";
import { describePumpFundsError, maxPumpBuySol, pumpLaunchBudget } from "@/lib/pump-curve";
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

function withEmptySignatures(transaction: VersionedTransaction): VersionedTransaction {
  const copy = VersionedTransaction.deserialize(transaction.serialize());
  for (let i = 0; i < copy.signatures.length; i += 1) {
    copy.signatures[i] = new Uint8Array(64);
  }
  return copy;
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

export async function assertWalletCanPayForPump(payer: PublicKey, solBuy: number): Promise<void> {
  const connection = new Connection(HELIUS_RPC_HTTP, { commitment: "confirmed" });
  const balance = await connection.getBalance(payer, "confirmed");
  const budget = pumpLaunchBudget(solBuy);
  const haveSol = balance / 1_000_000_000;
  if (haveSol + 1e-9 >= budget.totalSol) return;
  const maxBuy = maxPumpBuySol(balance);
  if (budget.buySol > 0 && maxBuy <= 0) {
    throw new Error(
      `Wallet has ${haveSol.toFixed(3)} SOL. Creating the token needs about ${budget.overheadSol.toFixed(3)} SOL for rent and fees before any buy. Add SOL or set the dev buy to 0.`,
    );
  }
  throw new Error(
    `Wallet has ${haveSol.toFixed(3)} SOL on-chain. A ${budget.buySol.toFixed(3)} SOL first buy plus create rent needs about ${budget.totalSol.toFixed(3)} SOL. Lower the dev buy to ${maxBuy.toFixed(3)} SOL or less.`,
  );
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
  await assertWalletCanPayForPump(args.wallet.publicKey, args.solBuy);

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

  const mintKeypair = Keypair.fromSecretKey(args.mintSecretKey);
  const tx = withEmptySignatures(VersionedTransaction.deserialize(bytesFromBase64(json.transaction)));
  const before = inspectPumpTx(tx);
  console.info("[OCG pump] wallet-bound unsigned tx (Phantom signs first)", {
    mint: json.mint,
    buyLamports: json.buyLamports,
    buyTokens: json.buyTokens,
    ...before,
  });
  if (before.feePayerSigned || before.mintSigned) {
    throw new Error("Create transaction must reach Phantom unsigned.");
  }

  const connection = new Connection(HELIUS_RPC_HTTP, { commitment: "confirmed" });
  const forSim = VersionedTransaction.deserialize(tx.serialize());
  forSim.sign([mintKeypair]);
  const clientSim = await simulatePumpTxVerbose({
    connection,
    transaction: forSim,
    label: "browser Helius before wallet sign",
    sigVerify: false,
    sizeWithoutAlt: json.simulation?.sizeWithoutAlt ?? null,
  });
  if (!clientSim.ok) {
    const logs = clientSim.logs.slice(-20).join("\n") || JSON.stringify(clientSim.err);
    const walletLamports = await connection.getBalance(args.wallet.publicKey, "confirmed");
    throw new Error(
      describePumpFundsError(logs, walletLamports / 1_000_000_000) ??
        `Pump create simulation failed before signing: ${logs}`,
    );
  }

  // Phantom: 2-signer txs must use signTransaction first, then other signers, then send.
  // https://docs.phantom.com/developer-powertools/domain-and-transaction-warnings
  console.info("[OCG pump] Phantom signTransaction first (multi-signer), then mint, then send");
  const walletSigned = await signMainnetVersionedTx({
    adapter: args.wallet.wallet?.adapter,
    signTransaction: args.wallet.signTransaction,
    transaction: tx,
  });
  const afterWallet = inspectPumpTx(walletSigned);
  console.info("[OCG pump] wallet-signed (mint still unsigned)", afterWallet);
  if (!afterWallet.feePayerSigned) {
    throw new Error("Wallet did not sign the Pump.fun transaction.");
  }

  walletSigned.sign([mintKeypair]);
  const complete = inspectPumpTx(walletSigned);
  console.info("[OCG pump] mint signature attached after Phantom", complete);
  if (!complete.feePayerSigned || !complete.mintSigned) {
    throw new Error("Create transaction is missing a required signature.");
  }

  const raw = walletSigned.serialize();
  console.info("[OCG pump] sending via Helius with preflight", { bytes: raw.length });
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 8,
    preflightCommitment: "confirmed",
  });

  console.info("[OCG pump] submitted", signature);
  await waitForSignature(connection, signature, json.lastValidBlockHeight);
  return { mint: new PublicKey(json.mint), signature };
}

export async function fetchPumpStats(mint: string): Promise<PumpCoinStats | null> {
  try {
    const response = await fetch(apiUrl("/api/market-caps"));
    if (!response.ok) return null;
    const json = (await response.json()) as Record<
      string,
      { marketCapUsd?: number; volumeUsd?: number; change24h?: number }
    >;
    const snap = json[mint];
    if (!snap) return null;
    return {
      usd_market_cap: snap.marketCapUsd,
      market_cap: snap.marketCapUsd,
      volume_24h: snap.volumeUsd,
      price_change_24h: snap.change24h,
    };
  } catch {
    return null;
  }
}

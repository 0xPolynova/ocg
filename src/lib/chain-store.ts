import { Buffer } from "buffer";
import type { Adapter, SendTransactionOptions } from "@solana/wallet-adapter-base";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { LEGACY_CHUNK_DATA_BYTES, NOOP_PROGRAM_ID } from "@/lib/constants";
import {
  assertFitsOnChain,
  compressGame,
  decodePayload,
  decompressGame,
  encodePayload,
  joinChunks,
  splitChunks,
} from "@/lib/game-codec";
import {
  isUserRejection,
  serializeNoopMessageV1,
  serializeUnsignedV1Transaction,
  signV1Transaction,
  v1WireSize,
  V1_MAX_TX_BYTES,
  walletSupportsV1,
} from "@/lib/solana-tx-v1";

type WalletSender = {
  publicKey: PublicKey | null;
  wallet?: { adapter: Adapter } | null;
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions,
  ) => Promise<string>;
  signAllTransactions?: <T extends Transaction>(transactions: T[]) => Promise<T[]>;
};

function mintBytes(mint: PublicKey): Uint8Array {
  return mint.toBytes();
}

export function buildNoopInstruction(data: Uint8Array): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(NOOP_PROGRAM_ID),
    keys: [],
    data: Buffer.from(data),
  });
}

function ixDataBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) return new Uint8Array(data);
  if (typeof data === "string") return Uint8Array.from(Buffer.from(data, "base64"));
  if (Array.isArray(data)) return Uint8Array.from(data as number[]);
  return new Uint8Array();
}

async function simulateV1(connection: Connection, wire: Uint8Array): Promise<void> {
  const response = await fetch(connection.rpcEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "simulateTransaction",
      params: [
        Buffer.from(wire).toString("base64"),
        {
          encoding: "base64",
          sigVerify: false,
          replaceRecentBlockhash: true,
          commitment: "confirmed",
        },
      ],
    }),
  });
  const json = (await response.json()) as {
    error?: { message?: string };
    result?: { value?: { err: unknown; logs?: string[] | null } };
  };
  if (json.error?.message) {
    throw new Error(json.error.message);
  }
  const value = json.result?.value;
  if (value?.err) {
    const logs = value.logs?.slice(-6).join(" | ") ?? JSON.stringify(value.err);
    throw new Error(`V1 simulation failed: ${logs}`);
  }
}

async function inscribeGameV1(args: {
  connection: Connection;
  adapter: Adapter;
  payer: PublicKey;
  payload: Uint8Array;
}): Promise<string> {
  if (v1WireSize(args.payload.length) > V1_MAX_TX_BYTES) {
    throw new Error("ROM does not fit in a 4096-byte Transaction V1.");
  }

  const { blockhash, lastValidBlockHeight } = await args.connection.getLatestBlockhash("confirmed");
  const message = serializeNoopMessageV1({
    payer: args.payer,
    noopProgram: new PublicKey(NOOP_PROGRAM_ID),
    recentBlockhash: blockhash,
    instructionData: args.payload,
  });
  const unsigned = serializeUnsignedV1Transaction(message);
  await simulateV1(args.connection, unsigned);

  const signed = await signV1Transaction({
    adapter: args.adapter,
    transaction: unsigned,
    chain: "solana:mainnet",
  });

  const signature = await args.connection.sendRawTransaction(signed, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  await args.connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}

async function inscribeGameLegacy(args: {
  connection: Connection;
  wallet: WalletSender;
  payload: Uint8Array;
}): Promise<string[]> {
  if (!args.wallet.publicKey) throw new Error("Connect a wallet first.");

  const chunks = splitChunks(args.payload, LEGACY_CHUNK_DATA_BYTES);
  const { blockhash, lastValidBlockHeight } =
    await args.connection.getLatestBlockhash("confirmed");

  const transactions = chunks.map((chunk) => {
    const tx = new Transaction().add(buildNoopInstruction(chunk));
    tx.feePayer = args.wallet.publicKey!;
    tx.recentBlockhash = blockhash;
    return tx;
  });

  const signatures: string[] = [];

  if (args.wallet.signAllTransactions && transactions.length > 1) {
    const signed = await args.wallet.signAllTransactions(transactions);
    for (const tx of signed) {
      const sig = await args.connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
      });
      signatures.push(sig);
    }
  } else {
    for (const tx of transactions) {
      const sig = await args.wallet.sendTransaction(tx, args.connection);
      signatures.push(sig);
    }
  }

  await Promise.all(
    signatures.map((signature) =>
      args.connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      ),
    ),
  );

  return signatures;
}

export async function inscribeGame(args: {
  connection: Connection;
  wallet: WalletSender;
  mint: PublicKey;
  html: string;
}): Promise<string[]> {
  if (!args.wallet.publicKey) throw new Error("Connect a wallet first.");

  const compressed = compressGame(args.html);
  assertFitsOnChain(compressed.byteLength);
  const payload = encodePayload(mintBytes(args.mint), compressed);
  const adapter = args.wallet.wallet?.adapter;
  const tryV1 = walletSupportsV1(adapter) && v1WireSize(payload.length) <= V1_MAX_TX_BYTES;

  if (tryV1 && adapter) {
    try {
      const signature = await inscribeGameV1({
        connection: args.connection,
        adapter,
        payer: args.wallet.publicKey,
        payload,
      });
      return [signature];
    } catch (err) {
      if (isUserRejection(err)) throw err;
      console.warn("Transaction V1 inscription failed, falling back to legacy chunks.", err);
    }
  }

  return inscribeGameLegacy({
    connection: args.connection,
    wallet: args.wallet,
    payload,
  });
}

export async function loadGameFromChain(
  connection: Connection,
  signatures: string[],
): Promise<string | null> {
  const chunks: Uint8Array[] = [];
  const noop = new PublicKey(NOOP_PROGRAM_ID);

  for (const signature of signatures) {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 1,
      commitment: "confirmed",
    });
    if (!tx) continue;
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys().staticAccountKeys;
    const instructions =
      "compiledInstructions" in message
        ? message.compiledInstructions
        : (message as { instructions: { programIdIndex: number; data: string | Uint8Array }[] })
            .instructions;

    for (const ix of instructions) {
      const programId = accountKeys[ix.programIdIndex];
      if (!programId?.equals(noop)) continue;
      chunks.push(ixDataBytes(ix.data));
    }
  }

  if (chunks.length === 0) return null;
  const decoded = decodePayload(joinChunks(chunks));
  if (!decoded) return null;
  return decompressGame(decoded.compressed);
}

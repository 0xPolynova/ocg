import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { SendTransactionOptions } from "@solana/wallet-adapter-base";

import { NOOP_PROGRAM_ID } from "@/lib/constants";
import {
  assertFitsOnChain,
  compressGame,
  decodePayload,
  decompressGame,
  encodePayload,
  joinChunks,
  splitChunks,
} from "@/lib/game-codec";

type WalletSender = {
  publicKey: PublicKey | null;
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
  const chunks = splitChunks(payload);
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
      const { data } = ix;
      chunks.push(
        typeof data === "string"
          ? Uint8Array.from(Buffer.from(data, "base64"))
          : Uint8Array.from(data),
      );
    }
  }

  if (chunks.length === 0) return null;
  const decoded = decodePayload(joinChunks(chunks));
  if (!decoded) return null;
  return decompressGame(decoded.compressed);
}

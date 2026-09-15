import type { Adapter, StandardWalletAdapter } from "@solana/wallet-adapter-base";
import {
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
  type SolanaSignAndSendTransactionFeature,
  type SolanaSignTransactionFeature,
  type SolanaTransactionVersion,
} from "@solana/wallet-standard-features";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

/** SIMD-0385 / SIMD-0296: v1 transactions start with this prefix. */
export const V1_PREFIX = 0x81;
export const V1_MAX_TX_BYTES = 4096;
export const V1_SIGNATURE_BYTES = 64;

const CONFIG_MASK_COMPUTE_UNIT_LIMIT = 0b00100;
const CONFIG_MASK_LOADED_ACCOUNTS = 0b01000;

/**
 * Fixed bytes for a 1-signer, 2-account (payer + noop), 1-instruction v1 tx
 * with CU limit + loaded-accounts config set and no instruction account metas.
 * 4096 - 182 = 3914 bytes of instruction data.
 */
export const V1_FIXED_OVERHEAD = 182;

export const V1_MAX_INSTRUCTION_DATA = V1_MAX_TX_BYTES - V1_FIXED_OVERHEAD;

export const V1_COMPUTE_UNIT_LIMIT = 50_000;
export const V1_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 65_536;

function writeU32LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

export function v1WireSize(instructionDataBytes: number): number {
  return V1_FIXED_OVERHEAD + instructionDataBytes;
}

export function serializeNoopMessageV1(args: {
  payer: PublicKey;
  noopProgram: PublicKey;
  recentBlockhash: string;
  instructionData: Uint8Array;
  computeUnitLimit?: number;
  loadedAccountsDataSizeLimit?: number;
}): Uint8Array {
  const data = args.instructionData;
  if (data.length > 0xffff) {
    throw new Error("V1 instruction data exceeds u16 length.");
  }

  const blockhash = bs58.decode(args.recentBlockhash);
  if (blockhash.length !== 32) {
    throw new Error("Invalid recent blockhash.");
  }

  const message = new Uint8Array(V1_FIXED_OVERHEAD - V1_SIGNATURE_BYTES + data.length);
  let o = 0;
  message[o++] = V1_PREFIX;
  message[o++] = 1; // numRequiredSignatures
  message[o++] = 0; // numReadonlySignedAccounts
  message[o++] = 1; // numReadonlyUnsignedAccounts

  writeU32LE(message, o, CONFIG_MASK_COMPUTE_UNIT_LIMIT | CONFIG_MASK_LOADED_ACCOUNTS);
  o += 4;

  message.set(blockhash, o);
  o += 32;

  message[o++] = 1; // num instructions
  message[o++] = 2; // num addresses
  message.set(args.payer.toBytes(), o);
  o += 32;
  message.set(args.noopProgram.toBytes(), o);
  o += 32;

  writeU32LE(message, o, args.computeUnitLimit ?? V1_COMPUTE_UNIT_LIMIT);
  o += 4;
  writeU32LE(message, o, args.loadedAccountsDataSizeLimit ?? V1_LOADED_ACCOUNTS_DATA_SIZE_LIMIT);
  o += 4;

  message[o++] = 1; // program_id_index = noop
  message[o++] = 0; // no account metas
  message[o++] = data.length & 0xff;
  message[o++] = (data.length >> 8) & 0xff;
  message.set(data, o);

  return message;
}

export function serializeUnsignedV1Transaction(message: Uint8Array): Uint8Array {
  const out = new Uint8Array(message.length + V1_SIGNATURE_BYTES);
  out.set(message, 0);
  return out;
}

export function v1Signature(signedTransaction: Uint8Array): string {
  const parsed = VersionedTransaction.deserialize(signedTransaction);
  const sig = parsed.signatures[0];
  if (!sig) throw new Error("Signed V1 transaction is missing a signature.");
  return bs58.encode(sig);
}

function isStandardAdapter(adapter: Adapter | undefined): adapter is StandardWalletAdapter {
  return Boolean(adapter && "standard" in adapter && adapter.standard === true && "wallet" in adapter);
}

function versionsOf(value: unknown): readonly SolanaTransactionVersion[] {
  if (!value || typeof value !== "object") return [];
  if (!("supportedTransactionVersions" in value)) return [];
  const versions = value.supportedTransactionVersions;
  if (Array.isArray(versions)) return versions as SolanaTransactionVersion[];
  if (versions instanceof Set) return [...versions] as SolanaTransactionVersion[];
  return [];
}

export function walletSupportsV1(adapter: Adapter | undefined | null): boolean {
  if (!adapter) return false;
  const adapterVersions = adapter.supportedTransactionVersions;
  if (adapterVersions instanceof Set && adapterVersions.has(1)) return true;

  if (!isStandardAdapter(adapter)) return false;
  const features = adapter.wallet.features;
  if (SolanaSignTransaction in features) {
    if (versionsOf(features[SolanaSignTransaction]).includes(1)) return true;
  }
  if (SolanaSignAndSendTransaction in features) {
    if (versionsOf(features[SolanaSignAndSendTransaction]).includes(1)) return true;
  }
  return false;
}

export async function signV1Transaction(args: {
  adapter: Adapter;
  transaction: Uint8Array;
  chain?: "solana:mainnet" | "solana:devnet" | "solana:testnet";
}): Promise<Uint8Array> {
  if (!isStandardAdapter(args.adapter)) {
    throw new Error("This wallet cannot sign Transaction V1.");
  }

  const std = args.adapter.wallet;
  const account = std.accounts[0];
  if (!account) throw new Error("Connect a wallet first.");

  const chain = args.chain ?? "solana:mainnet";
  const features = std.features;

  if (SolanaSignTransaction in features) {
    const [output] = await (features as SolanaSignTransactionFeature)[SolanaSignTransaction].signTransaction({
      account,
      transaction: args.transaction,
      chain,
    });
    const signed = output?.signedTransaction;
    if (!signed?.length) throw new Error("Wallet returned an empty V1 transaction.");
    if (signed[0] !== V1_PREFIX) {
      throw new Error("Wallet did not return a Transaction V1 envelope.");
    }
    if (signed.length > V1_MAX_TX_BYTES) {
      throw new Error(`Signed V1 transaction is ${signed.length} bytes (max ${V1_MAX_TX_BYTES}).`);
    }
    return signed;
  }

  if (SolanaSignAndSendTransaction in features && account.features.includes(SolanaSignAndSendTransaction)) {
    throw new Error("Wallet can send V1 but not return the signed bytes; use a wallet with signTransaction.");
  }

  throw new Error("This wallet cannot sign Transaction V1.");
}

export function isUserRejection(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /reject|cancel|denied|declined|not approved/i.test(message);
}

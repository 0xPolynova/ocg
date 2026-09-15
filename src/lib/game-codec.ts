import { gzip, inflate } from "pako";

import { CHUNK_DATA_BYTES, MAX_GAME_BYTES, OCG_MAGIC } from "@/lib/constants";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8Bytes(value: string): number {
  return encoder.encode(value).byteLength;
}

export function compressGame(html: string): Uint8Array {
  return gzip(html, { level: 9 });
}

export function decompressGame(bytes: Uint8Array): string {
  return decoder.decode(inflate(bytes));
}

export function encodePayload(mint: Uint8Array, compressed: Uint8Array): Uint8Array {
  const magic = encoder.encode(OCG_MAGIC);
  const out = new Uint8Array(magic.length + 1 + mint.length + compressed.length);
  out.set(magic, 0);
  out[magic.length] = 1;
  out.set(mint, magic.length + 1);
  out.set(compressed, magic.length + 1 + mint.length);
  return out;
}

export function decodePayload(data: Uint8Array): { mint: Uint8Array; compressed: Uint8Array } | null {
  const magic = encoder.encode(OCG_MAGIC);
  if (data.length < magic.length + 1 + 32) return null;
  for (let i = 0; i < magic.length; i += 1) {
    if (data[i] !== magic[i]) return null;
  }
  const mint = data.slice(magic.length + 1, magic.length + 1 + 32);
  const compressed = data.slice(magic.length + 1 + 32);
  return { mint, compressed };
}

export function splitChunks(payload: Uint8Array): Uint8Array[] {
  if (payload.length <= CHUNK_DATA_BYTES) return [payload];
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < payload.length; offset += CHUNK_DATA_BYTES) {
    chunks.push(payload.slice(offset, offset + CHUNK_DATA_BYTES));
  }
  return chunks;
}

export function joinChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function assertFitsOnChain(compressedBytes: number): void {
  if (compressedBytes > MAX_GAME_BYTES) {
    throw new Error(
      `Game is ${compressedBytes} gzipped bytes. On-chain limit is ${MAX_GAME_BYTES} bytes.`,
    );
  }
}

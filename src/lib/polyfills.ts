import { Buffer } from "buffer";

export function ensureBuffer(): void {
  if (typeof globalThis.Buffer === "undefined") {
    globalThis.Buffer = Buffer;
  }
}

if (typeof window !== "undefined") {
  ensureBuffer();
}

export const APP_NAME = "OCG";
export const APP_TAGLINE = "OnChainGame";
export const APP_DESCRIPTION =
  "Prompt a tiny playable game, inscribe it on Solana, and launch it as a Pump.fun token.";

/**
 * Hard cap for gzipped game bytes stored in Solana instruction data.
 * Transaction V1 (SIMD-0385) is 4096 bytes on the wire; one noop inscription
 * leaves ~3914 bytes of instruction data, minus the OCG1 + mint header.
 */
export const MAX_TX_BYTES_V1 = 4096;
export const MAX_GAME_BYTES = 3800;
/** Raw HTML budget. Gzip of dense JS is often ~2–3×, then we shrink if needed. */
export const TARGET_RAW_BYTES = 12500;

export const OPENROUTER_MODEL_DEFAULT = "qwen/qwen3-coder-next";
/** HTML ROM coder — cheap coding model, stronger at JS than Gemini Flash. */
export const OPENROUTER_CODE_MODEL_DEFAULT = "qwen/qwen3-coder";
export const OPENROUTER_FALLBACK_MODEL = "google/gemini-2.5-flash";

export const PUMP_FUN_COIN_URL = "https://pump.fun/coin";

/** SPL Account Compression noop — accepts arbitrary instruction data. */
export const NOOP_PROGRAM_ID = "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV";

export const OCG_MAGIC = "OCG1";
export const STORAGE_KEY = "ocg:launches";
/** V1 instruction-data budget per tx (4096 − 182-byte envelope). */
export const CHUNK_DATA_BYTES = 3914;
/** Legacy / v0 txs still max out at 1232 bytes on the wire. */
export const LEGACY_CHUNK_DATA_BYTES = 780;

export const GENRES = [
  "All",
  "Arcade",
  "Action",
  "Puzzle",
  "Reflex",
  "Custom",
] as const;

export type Genre = (typeof GENRES)[number];

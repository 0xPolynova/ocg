export const APP_NAME = "OCG";
export const APP_TAGLINE = "OnChainGame";
export const APP_DESCRIPTION =
  "Prompt, play, launch a token on Pump.fun.";

/** Soft target for generated HTML. One model pass, not a novella. */
export const TARGET_RAW_BYTES = 14000;

export const OPENROUTER_MODEL_DEFAULT = "qwen/qwen3-coder-next";
/** HTML game coder — same long-context cheap model as planning. */
export const OPENROUTER_CODE_MODEL_DEFAULT = "qwen/qwen3-coder-next";
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

export const APP_NAME = "OCG";
export const APP_TAGLINE = "OnChainGame";
export const APP_PITCH = "Build, launch, Play.";
export const APP_DESCRIPTION = "Build, launch, Play.";

/** Soft target for generated HTML. One model pass, not a novella. */
export const TARGET_RAW_BYTES = 18000;

export const OPENROUTER_MODEL_DEFAULT = "deepseek/deepseek-v4-flash";
/** Current cheap DeepSeek coder. V3.2 is a reasoning model and often ships empty HTML. */
export const OPENROUTER_CODE_MODEL_DEFAULT = "deepseek/deepseek-v4-flash";
/** Same-family then MiniMax — never Gemini. */
export const OPENROUTER_FALLBACK_MODELS = [
  "deepseek/deepseek-v3.2",
  "minimax/minimax-m2.5",
] as const;

export const PUMP_FUN_COIN_URL = "https://pump.fun/coin";
export const SOLSCAN_TOKEN_URL = "https://solscan.io/token";
export const SOLSCAN_TX_URL = "https://solscan.io/tx";

export function solscanTokenUrl(mint: string): string {
  return `${SOLSCAN_TOKEN_URL}/${mint}#metadata`;
}
export const OCG_X_URL = "https://x.com/launchOCG";

/** SPL Account Compression noop — accepts arbitrary instruction data. */
export const NOOP_PROGRAM_ID = "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV";

export const OCG_MAGIC = "OCG1";
export const STORAGE_KEY = "ocg:launches";
export const STUDIO_STORAGE_KEY = "ocg:studio-drafts";
export const STUDIO_ACTIVE_KEY = "ocg:studio-active";
export const STUDIO_MAX_DRAFTS = 16;
export const CHAT_COOLDOWN_MS = 30_000;
export const CHAT_MAX_USER_MESSAGES = 10;
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

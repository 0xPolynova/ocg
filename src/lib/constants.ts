export const APP_NAME = "OCG";
export const APP_TAGLINE = "OnChainGame";
export const APP_DESCRIPTION =
  "Prompt a tiny playable game, inscribe it on Solana, and launch it as a Pump.fun token.";

/** Hard cap for gzipped game bytes stored in Solana instruction data. */
export const MAX_GAME_BYTES = 3000;
/** Ask the model to stay under this so gzip + headers still fit. */
export const TARGET_RAW_BYTES = 2800;

export const OPENROUTER_MODEL_DEFAULT = "google/gemini-2.5-flash";

export const PUMP_FUN_COIN_URL = "https://pump.fun/coin";

/** SPL Account Compression noop — accepts arbitrary instruction data. */
export const NOOP_PROGRAM_ID = "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV";

export const OCG_MAGIC = "OCG1";
export const STORAGE_KEY = "ocg:launches";
export const CHUNK_DATA_BYTES = 780;

export const GENRES = [
  "All",
  "Arcade",
  "Action",
  "Puzzle",
  "Reflex",
  "Custom",
] as const;

export type Genre = (typeof GENRES)[number];

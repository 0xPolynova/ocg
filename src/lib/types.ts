import type { Genre } from "@/lib/constants";

export type OcgLaunch = {
  id: string;
  name: string;
  symbol: string;
  description: string;
  prompt: string;
  genre: Exclude<Genre, "All">;
  gameHtml: string;
  gameBytes: number;
  compressedBytes: number;
  image?: string;
  mint?: string;
  creator?: string;
  slug?: string;
  playUrl?: string;
  storeSignatures: string[];
  createSignature?: string;
  createdAt: number;
  demo?: boolean;
  marketCapUsd?: number;
  volumeUsd?: number;
  change24h?: number;
  sparkline: number[];
};

export type GenerateGameResponse = {
  html: string;
  name: string;
  symbol: string;
  genre: Exclude<Genre, "All">;
  mechanic?: string;
  bytes: number;
  compressedBytes: number;
  model: string;
  fallback?: boolean;
  error?: string;
};

export type PumpCoinStats = {
  usd_market_cap?: number;
  market_cap?: number;
  volume_24h?: number;
  price_change_24h?: number;
  name?: string;
  symbol?: string;
  image_uri?: string;
};

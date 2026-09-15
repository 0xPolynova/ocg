import { PublicKey } from "@solana/web3.js";

import type { OcgLaunch } from "../src/lib/types";
import { applyLaunchStats, listLaunches } from "./db";

const TRACKER_URL = "https://data.solanatracker.io/price/multi";
const BATCH_SIZE = 100;
export const MARKET_CAP_INTERVAL_MS = 15_000;

export type MarketCapSnapshot = {
  marketCapUsd?: number;
  volumeUsd?: number;
  change24h?: number;
  updatedAt: number;
};

type TrackerPrice = {
  price?: number;
  liquidity?: number;
  marketCap?: number;
  lastUpdated?: number;
  priceChanges?: Record<string, { priceChangePercentage?: number }>;
};

const cache = new Map<string, MarketCapSnapshot>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;

function trackerKey(): string {
  return process.env.SOLANA_TRACKER_API_KEY?.trim() ?? "";
}

function isMintAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return value.length >= 32 && value.length <= 44;
  } catch {
    return false;
  }
}

export function getMarketCapCache(): Record<string, MarketCapSnapshot> {
  const next: Record<string, MarketCapSnapshot> = {};
  for (const [mint, snap] of cache) next[mint] = snap;
  return next;
}

export function overlayMarketCaps(launches: OcgLaunch[]): OcgLaunch[] {
  return launches.map((launch) => {
    const mint = launch.mint;
    if (!mint) return launch;
    const snap = cache.get(mint);
    if (!snap) return launch;
    return {
      ...launch,
      marketCapUsd: snap.marketCapUsd ?? launch.marketCapUsd,
      volumeUsd: snap.volumeUsd ?? launch.volumeUsd,
      change24h: snap.change24h ?? launch.change24h,
    };
  });
}

function uniqueMints(launches: OcgLaunch[]): string[] {
  const seen = new Set<string>();
  const mints: string[] = [];
  for (const launch of launches) {
    const mint = launch.mint?.trim();
    if (!mint || seen.has(mint)) continue;
    if (!isMintAddress(mint)) continue;
    if (launch.creator && mint === launch.creator) continue;
    seen.add(mint);
    mints.push(mint);
  }
  return mints;
}

async function fetchBatch(tokens: string[], apiKey: string): Promise<Record<string, TrackerPrice>> {
  const response = await fetch(TRACKER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ tokens, priceChanges: true }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Solana Tracker ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }
  return (await response.json()) as Record<string, TrackerPrice>;
}

export async function refreshMarketCaps(): Promise<Record<string, MarketCapSnapshot>> {
  const apiKey = trackerKey();
  if (!apiKey) return getMarketCapCache();

  const launches = await listLaunches();
  const mints = uniqueMints(launches);
  if (mints.length === 0) return getMarketCapCache();

  for (let i = 0; i < mints.length; i += BATCH_SIZE) {
    const slice = mints.slice(i, i + BATCH_SIZE);
    const prices = await fetchBatch(slice, apiKey);
    const now = Date.now();
    for (const mint of slice) {
      const row = prices[mint];
      if (!row || typeof row.marketCap !== "number") continue;
      const snap: MarketCapSnapshot = {
        marketCapUsd: row.marketCap,
        change24h: row.priceChanges?.["24h"]?.priceChangePercentage,
        updatedAt: typeof row.lastUpdated === "number" ? row.lastUpdated : now,
      };
      cache.set(mint, snap);
      await applyLaunchStats(mint, {
        marketCapUsd: snap.marketCapUsd,
        change24h: snap.change24h,
      });
    }
  }

  return getMarketCapCache();
}

export function startMarketCapPoller(): void {
  if (pollTimer) return;
  if (!trackerKey()) {
    console.warn("[OCG] SOLANA_TRACKER_API_KEY missing — launch cards will not show live market caps.");
    return;
  }
  const tick = async () => {
    if (polling) return;
    polling = true;
    try {
      await refreshMarketCaps();
    } catch (error) {
      console.error("[OCG] Solana Tracker market-cap poll failed", error);
    } finally {
      polling = false;
    }
  };
  void tick();
  pollTimer = setInterval(() => void tick(), MARKET_CAP_INTERVAL_MS);
}

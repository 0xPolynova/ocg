import { apiUrl } from "@/lib/api";
import { STORAGE_KEY } from "@/lib/constants";
import type { OcgLaunch } from "@/lib/types";

const CHANGE_EVENT = "ocg:launches";
const EMPTY: OcgLaunch[] = [];

let cachedRaw: string | null = null;
let cachedValue: OcgLaunch[] = EMPTY;
let hydrating: Promise<OcgLaunch[]> | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getEmptyLaunches(): OcgLaunch[] {
  return EMPTY;
}

export function readLaunches(): OcgLaunch[] {
  if (!canUseStorage()) return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (!raw) {
    cachedValue = EMPTY;
    return EMPTY;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    cachedValue = Array.isArray(parsed) ? (parsed as OcgLaunch[]) : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

export function writeLaunches(launches: OcgLaunch[]): void {
  if (!canUseStorage()) return;
  const raw = JSON.stringify(launches);
  cachedRaw = raw;
  cachedValue = launches;
  window.localStorage.setItem(STORAGE_KEY, raw);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function mergeLaunches(primary: OcgLaunch[], secondary: OcgLaunch[]): OcgLaunch[] {
  const seen = new Set<string>();
  const next: OcgLaunch[] = [];
  for (const launch of [...primary, ...secondary]) {
    const key = launch.mint ?? launch.id;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(launch);
  }
  return next.sort((a, b) => b.createdAt - a.createdAt);
}

export async function hydrateLaunches(): Promise<OcgLaunch[]> {
  if (!canUseStorage()) return EMPTY;
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const response = await fetch(apiUrl("/api/launches"));
        if (!response.ok) return readLaunches();
        const remote = (await response.json()) as OcgLaunch[];
        if (!Array.isArray(remote)) return readLaunches();
        writeLaunches(remote);
        return readLaunches();
      } catch {
        return readLaunches();
      }
    })().finally(() => {
      hydrating = null;
    });
  }
  return hydrating;
}

function launchMatches(item: OcgLaunch, id: string): boolean {
  const needle = id.trim().toLowerCase();
  if (!needle) return false;
  return (
    item.id.toLowerCase() === needle ||
    item.mint?.toLowerCase() === needle ||
    item.symbol.toLowerCase() === needle ||
    (item.slug ?? "").toLowerCase() === needle ||
    item.symbol.replace(/[^a-z0-9]/gi, "").toLowerCase() === needle
  );
}

export async function fetchLaunch(id: string): Promise<OcgLaunch | null> {
  const local = readLaunches().find((item) => launchMatches(item, id));
  if (local) return local;
  try {
    const hydrated = await hydrateLaunches();
    const fromCache = hydrated.find((item) => launchMatches(item, id));
    if (fromCache) return fromCache;
    const response = await fetch(apiUrl(`/api/launches/${encodeURIComponent(id)}`));
    if (!response.ok) return null;
    const launch = (await response.json()) as OcgLaunch | null;
    if (!launch?.id) return null;
    writeLaunches(mergeLaunches([launch], readLaunches()));
    return launch;
  } catch {
    return null;
  }
}

export async function upsertLaunch(launch: OcgLaunch): Promise<OcgLaunch[]> {
  const next = mergeLaunches([launch], readLaunches());
  writeLaunches(next);
  try {
    await fetch(apiUrl("/api/launches"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(launch),
    }).then(async (response) => {
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Could not save the launch card.");
      }
    });
  } catch {
    // Keep the local copy even if the API is down.
  }
  return next;
}

export async function fetchMarketCaps(): Promise<Record<string, Partial<OcgLaunch>>> {
  try {
    const response = await fetch(apiUrl("/api/market-caps"));
    if (!response.ok) return {};
    const json = (await response.json()) as Record<
      string,
      { marketCapUsd?: number; volumeUsd?: number; change24h?: number }
    >;
    const next: Record<string, Partial<OcgLaunch>> = {};
    for (const [mint, snap] of Object.entries(json ?? {})) {
      next[mint] = {
        marketCapUsd: snap.marketCapUsd,
        volumeUsd: snap.volumeUsd,
        change24h: snap.change24h,
      };
    }
    return next;
  } catch {
    return {};
  }
}

export function subscribeLaunches(onChange: () => void): () => void {
  if (!canUseStorage()) return () => undefined;
  const handler = () => onChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

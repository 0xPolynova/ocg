import { STORAGE_KEY } from "@/lib/constants";
import type { OcgLaunch } from "@/lib/types";

const CHANGE_EVENT = "ocg:launches";
const EMPTY: OcgLaunch[] = [];

let cachedRaw: string | null = null;
let cachedValue: OcgLaunch[] = EMPTY;

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

export function upsertLaunch(launch: OcgLaunch): OcgLaunch[] {
  const current = readLaunches().filter((item) => item.id !== launch.id);
  const next = [launch, ...current];
  writeLaunches(next);
  return next;
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

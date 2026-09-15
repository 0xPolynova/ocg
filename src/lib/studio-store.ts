import { STUDIO_ACTIVE_KEY, STUDIO_MAX_DRAFTS, STUDIO_STORAGE_KEY } from "@/lib/constants";
import type { GenerateGameResponse } from "@/lib/types";

export type StudioChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type StudioDraft = {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: StudioChatMessage[];
  composer: string;
  game: GenerateGameResponse | null;
  name: string;
  symbol: string;
  description: string;
  imagePreview: string | null;
  imageCustom: boolean;
  twitter: string;
  telegram: string;
  website: string;
  mayhemMode: boolean;
  buyMode: "pct" | "sol";
  solBuy: number;
  mint?: string;
  createSignature?: string;
};

export type StudioCache = {
  drafts: StudioDraft[];
  activeId: string;
};

const CHANGE_EVENT = "ocg:studio";

let cachedRaw: string | null = null;
let cachedActive: string | null = null;
let cachedValue: StudioCache | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function emptyDraft(): StudioDraft {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    messages: [],
    composer: "",
    game: null,
    name: "",
    symbol: "",
    description: "",
    imagePreview: null,
    imageCustom: false,
    twitter: "",
    telegram: "",
    website: "",
    mayhemMode: false,
    buyMode: "sol",
    solBuy: 0,
  };
}

export function isDraftLocked(draft: StudioDraft): boolean {
  return Boolean(draft.mint || draft.createSignature);
}

export function draftTabLabel(draft: StudioDraft): string {
  const ticker = draft.symbol.trim();
  if (ticker) return ticker.toUpperCase();
  const name = draft.name.trim();
  if (name) return name;
  const prompt = draft.messages.find((item) => item.role === "user")?.content.trim();
  if (prompt) return prompt.slice(0, 18);
  return "New game";
}

function parseDraft(value: unknown): StudioDraft | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<StudioDraft>;
  if (typeof item.id !== "string" || !item.id) return null;
  return {
    ...emptyDraft(),
    ...item,
    id: item.id,
    createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
    updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
    messages: Array.isArray(item.messages) ? item.messages : [],
    composer: typeof item.composer === "string" ? item.composer : "",
    game: item.game ?? null,
    name: typeof item.name === "string" ? item.name : "",
    symbol: typeof item.symbol === "string" ? item.symbol : "",
    description: typeof item.description === "string" ? item.description : "",
    imagePreview: typeof item.imagePreview === "string" ? item.imagePreview : null,
    imageCustom: Boolean(item.imageCustom),
    twitter: typeof item.twitter === "string" ? item.twitter : "",
    telegram: typeof item.telegram === "string" ? item.telegram : "",
    website: typeof item.website === "string" ? item.website : "",
    mayhemMode: Boolean(item.mayhemMode),
    buyMode: item.buyMode === "pct" ? "pct" : "sol",
    solBuy: typeof item.solBuy === "number" ? item.solBuy : 0,
    mint: typeof item.mint === "string" ? item.mint : undefined,
    createSignature: typeof item.createSignature === "string" ? item.createSignature : undefined,
  };
}

function readCache(): StudioCache {
  if (!canUseStorage()) {
    const draft = emptyDraft();
    return { drafts: [draft], activeId: draft.id };
  }
  const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY);
  const activeId = window.localStorage.getItem(STUDIO_ACTIVE_KEY);
  if (raw === cachedRaw && activeId === cachedActive && cachedValue) return cachedValue;

  cachedRaw = raw;
  cachedActive = activeId;

  let drafts: StudioDraft[] = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        drafts = parsed.map(parseDraft).filter((item): item is StudioDraft => Boolean(item));
      }
    } catch {
      drafts = [];
    }
  }
  if (drafts.length === 0) drafts = [emptyDraft()];

  const next: StudioCache = {
    drafts,
    activeId: drafts.some((item) => item.id === activeId) ? (activeId as string) : drafts[0].id,
  };
  cachedValue = next;
  return next;
}

function writeCache(cache: StudioCache): void {
  if (!canUseStorage()) return;
  const drafts = cache.drafts.slice(0, STUDIO_MAX_DRAFTS);
  const activeId = drafts.some((item) => item.id === cache.activeId) ? cache.activeId : drafts[0]?.id;
  const next: StudioCache = { drafts, activeId: activeId ?? emptyDraft().id };
  const raw = JSON.stringify(next.drafts);
  cachedRaw = raw;
  cachedActive = next.activeId;
  cachedValue = next;
  window.localStorage.setItem(STUDIO_STORAGE_KEY, raw);
  window.localStorage.setItem(STUDIO_ACTIVE_KEY, next.activeId);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readStudioCache(): StudioCache {
  return readCache();
}

export function writeStudioCache(cache: StudioCache): void {
  writeCache(cache);
}

export function subscribeStudioCache(onChange: () => void): () => void {
  if (!canUseStorage()) return () => undefined;
  const handler = () => onChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

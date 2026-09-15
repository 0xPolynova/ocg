import { apiUrl, readJson } from "@/lib/api";
import {
  isChatCapped,
  isDraftLocked,
  patchStudioDraft,
  readStudioCache,
  userPromptCount,
  type StudioChatMessage,
} from "@/lib/studio-store";
import { CHAT_COOLDOWN_MS, CHAT_MAX_USER_MESSAGES } from "@/lib/constants";
import type { GenerateGameResponse } from "@/lib/types";

const jobs = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

export function subscribeStudioJobs(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function studioJobsSnapshot(): string {
  return [...jobs.keys()].sort().join(",");
}

export function isStudioGenerating(draftId: string): boolean {
  return jobs.has(draftId);
}

function notifyJobs(): void {
  for (const listener of listeners) listener();
}

export function clearStaleStudioGenerations(): void {
  for (const draft of readStudioCache().drafts) {
    if (!draft.generatingStartedAt || jobs.has(draft.id)) continue;
    patchStudioDraft(draft.id, { generatingStartedAt: undefined });
  }
}

export function startStudioGenerate(text: string, draftId?: string): string | null {
  const cache = readStudioCache();
  const id = draftId ?? cache.activeId;
  const draft = cache.drafts.find((item) => item.id === id);
  if (!draft) return null;
  if (isDraftLocked(draft) || jobs.has(draft.id)) {
    return jobs.has(draft.id) ? "This game is already building." : null;
  }
  const trimmed = text.trim();
  if (trimmed.length < 3) return "Describe the game in a bit more detail.";
  if (userPromptCount(draft) >= CHAT_MAX_USER_MESSAGES) {
    return `This game used all ${CHAT_MAX_USER_MESSAGES} prompts. Open a new tab.`;
  }
  if (draft.lastPromptAt && Date.now() - draft.lastPromptAt < CHAT_COOLDOWN_MS) {
    const wait = Math.ceil((CHAT_COOLDOWN_MS - (Date.now() - draft.lastPromptAt)) / 1000);
    return `Wait ${wait}s before sending another prompt.`;
  }

  const userMessage: StudioChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: trimmed,
  };
  const history = [...draft.messages, userMessage];
  const hadGame = Boolean(draft.game);
  patchStudioDraft(draft.id, {
    messages: history,
    composer: "",
    lastPromptAt: Date.now(),
    generatingStartedAt: Date.now(),
  });

  const promise = (async () => {
    try {
      const response = await fetch(apiUrl("/api/generate-game"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          messages: history.map(({ role, content }) => ({ role, content })),
          html: draft.game?.html,
          name: draft.name,
          symbol: draft.symbol,
          mechanic: draft.game?.mechanic,
        }),
      });
      const json = await readJson<GenerateGameResponse & { error?: string }>(response);
      if (!response.ok && !json.html) throw new Error(json.error ?? "Could not generate a game.");
      const reply =
        json.reply?.trim() ||
        (hadGame ? "Updated. Play it above." : "Game ready. Play it, then launch.");
      const latest = readStudioCache().drafts.find((item) => item.id === draft.id);
      const currentMessages = latest?.messages ?? history;
      const last = currentMessages[currentMessages.length - 1];
      const nextMessages =
        last?.role === "assistant" && last.content === reply
          ? currentMessages
          : [...currentMessages, { id: crypto.randomUUID(), role: "assistant" as const, content: reply }];
      const firstBuild = !hadGame;
      patchStudioDraft(draft.id, {
        messages: nextMessages,
        generatingStartedAt: undefined,
        ...(json.html
          ? {
              game: json,
              name: firstBuild ? json.name : latest?.name || json.name,
              symbol: firstBuild ? json.symbol : latest?.symbol || json.symbol,
              description: firstBuild ? trimmed.slice(0, 200) : latest?.description,
              ...(firstBuild ? { website: "", imagePreview: null, imageCustom: false } : {}),
            }
          : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      const latest = readStudioCache().drafts.find((item) => item.id === draft.id);
      const currentMessages = latest?.messages ?? history;
      patchStudioDraft(draft.id, {
        generatingStartedAt: undefined,
        messages: [
          ...currentMessages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              message === "Failed to fetch"
                ? "Could not reach the game API. Check that ocg-api is live."
                : message,
          },
        ],
      });
    }
  })().finally(() => {
    jobs.delete(draft.id);
    notifyJobs();
  });

  jobs.set(draft.id, promise);
  notifyJobs();
  return null;
}

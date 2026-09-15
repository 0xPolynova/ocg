"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type StudioChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const STARTERS = [
  {
    label: "Orbit Cat",
    prompt: "A one-button dodge game where a cat weaves through falling moons",
  },
  {
    label: "Neon Snake",
    prompt: "Neon snake in a shrinking box — eat bits, don't hit the tail",
  },
  {
    label: "Asteroids",
    prompt: "Tiny spaceship blasting incoming asteroids, one-tap fire",
  },
  {
    label: "Toxic Frog",
    prompt: "Frog hopping logs across a toxic canal, miss and splash",
  },
  {
    label: "Pipe Bird",
    prompt: "Flappy bird through neon pipes, tap to flap, don't clip the gap",
  },
  {
    label: "Memory Pulse",
    prompt: "Simon-style memory game: repeat the glowing pad sequence",
  },
  {
    label: "DOOM",
    prompt: "Doom — first person corridors, shotgun, demons",
  },
];

export function GamePromptChat({
  messages,
  draft,
  onDraftChange,
  onSend,
  thinking,
  disabled,
}: {
  messages: StudioChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  thinking: boolean;
  disabled: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const empty = messages.length === 0 && !thinking;

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, thinking]);

  function submit() {
    const text = draft.trim();
    if (disabled || thinking || text.length < 3) return;
    onSend(text);
  }

  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium">Game chat</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {empty
            ? "Prompt a game, then iterate — the agent keeps this chat and the current build."
            : "Ask for changes. The agent already has the current game."}
        </p>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {empty ? (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((idea) => (
              <button
                key={idea.label}
                type="button"
                disabled={disabled || thinking}
                onClick={() => onDraftChange(idea.prompt)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                {idea.label}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-foreground",
              )}
            >
              {message.content}
            </div>
          </div>
        ))}

        <AnimatePresence>
          {thinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex justify-start"
            >
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                Thinking…
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <form
        className="border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/50">
          <textarea
            value={draft}
            rows={empty ? 3 : 2}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={empty ? "A microscopic snake game with neon walls" : "Make the player faster, add a boss…"}
            className="max-h-40 min-h-[52px] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={disabled || thinking || draft.trim().length < 3}
            className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
            aria-label={empty ? "Generate game" : "Send"}
          >
            {thinking ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </form>
    </section>
  );
}

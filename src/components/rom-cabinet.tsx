"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { GameFrame } from "@/components/game-frame";
import type { GenerateGameResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const LOADING_LINES = [
  "Writing the design…",
  "Building the world…",
  "Drawing the character…",
  "Tuning the loop…",
  "Packing the game…",
];

export function RomCabinet({
  game,
  generating,
  title,
  onShot,
  locked,
}: {
  game: GenerateGameResponse | null;
  generating: boolean;
  title: string;
  onShot?: (dataUrl: string) => void;
  locked?: boolean;
}) {
  const [line, setLine] = useState(0);

  const shownLine = generating ? line : 0;

  useEffect(() => {
    if (!generating) return;
    const id = window.setInterval(() => {
      setLine((current) => (current + 1) % LOADING_LINES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [generating]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5">
        <p className="truncate text-sm font-medium">
          {generating ? (game ? "Updating game" : "Building game") : title || "Preview"}
        </p>
        <p className="shrink-0 text-xs text-muted-foreground">
          {locked ? "Launched" : generating ? "Working" : game ? "Ready to play" : "Waiting for a prompt"}
        </p>
      </div>
      <div className="relative min-h-0 flex-1 bg-background">
        <AnimatePresence mode="wait">
          {generating && !game ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                className="size-10 rounded-full border-2 border-border border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
              />
              <AnimatePresence mode="wait">
                <motion.p
                  key={LOADING_LINES[shownLine]}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-sm text-foreground"
                >
                  {LOADING_LINES[shownLine]}
                </motion.p>
              </AnimatePresence>
              <div className="h-1 w-36 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full w-2/5 bg-primary"
                  animate={{ x: ["-100%", "250%"] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          ) : game ? (
            <motion.div
              key={game.html.slice(0, 48)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-hidden"
            >
              <GameFrame html={game.html} title={title || "Preview"} onShot={onShot} />
              {generating ? (
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-background/70 py-1.5 text-xs text-foreground backdrop-blur-sm">
                  <motion.span
                    className="size-3 rounded-full border border-border border-t-primary"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                  />
                  Applying your change…
                </div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground"
            >
              <p>Describe a game in the chat below.</p>
              <p className="text-xs">The playable build shows up here.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {game && !generating ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          <span className="truncate">
            {game.bytes.toLocaleString()} bytes · {game.mechanic ?? game.genre}
          </span>
          <span className={cn(locked ? "text-primary" : game.fallback ? "text-muted-foreground" : "text-positive")}>
            {locked ? "Token live" : game.fallback ? "Fallback ROM" : "Play page"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

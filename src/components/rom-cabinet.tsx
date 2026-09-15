"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { GameFrame } from "@/components/game-frame";
import type { GenerateGameResponse } from "@/lib/types";

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
}: {
  game: GenerateGameResponse | null;
  generating: boolean;
  title: string;
  onShot?: (dataUrl: string) => void;
}) {
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!generating) {
      setLine(0);
      return;
    }
    const id = window.setInterval(() => {
      setLine((current) => (current + 1) % LOADING_LINES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [generating]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">
          {generating ? "Building game" : title || "Preview"}
        </p>
        <p className="text-xs text-muted-foreground">
          {generating ? "Working" : "Ready to play"}
        </p>
      </div>
      <div className="relative aspect-[16/10] bg-background">
        <AnimatePresence mode="wait">
          {generating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
            >
              <motion.div
                className="size-12 rounded-full border-2 border-border border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
              />
              <AnimatePresence mode="wait">
                <motion.p
                  key={LOADING_LINES[line]}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-sm text-foreground"
                >
                  {LOADING_LINES[line]}
                </motion.p>
              </AnimatePresence>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full w-2/5 bg-primary"
                  animate={{ x: ["-100%", "250%"] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          ) : game ? (
            <motion.div
              key="play"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-hidden"
            >
              <GameFrame html={game.html} title={title || "Preview"} onShot={onShot} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {game && !generating ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="truncate">
            {game.bytes.toLocaleString()} bytes · {game.mechanic ?? game.genre}
          </span>
          <span className="text-positive">Play page</span>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { GameFrame } from "@/components/game-frame";
import { MAX_GAME_BYTES } from "@/lib/constants";
import type { GenerateGameResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const LOADING_LINES = [
  "Writing the design…",
  "Building the world…",
  "Drawing the character…",
  "Tuning the loop…",
  "Packing the ROM…",
];

export function RomCabinet({
  game,
  generating,
  title,
}: {
  game: GenerateGameResponse | null;
  generating: boolean;
  title: string;
}) {
  const [line, setLine] = useState(0);
  const compressed = game?.compressedBytes ?? 0;
  const overLimit = compressed > MAX_GAME_BYTES;
  const meter = game ? Math.min(100, Math.round((compressed / MAX_GAME_BYTES) * 100)) : 0;

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
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border border-border bg-black shadow-[0_0_0_1px_rgba(143,212,222,0.08),0_20px_80px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[10px] tracking-[0.22em] text-cyan/80 uppercase">
        <span>OCG · arcade cabinet</span>
        <span>{generating ? "compiling" : game ? "ready" : "standby"}</span>
      </div>
      <div className="relative aspect-[16/10] bg-[#041014]">
        <AnimatePresence mode="wait">
          {generating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
            >
              <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_2px,rgba(0,0,0,.18)_2px_3px)]" />
              <motion.div
                className="size-16 rounded-full border-2 border-cyan/30 border-t-cyan"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
              />
              <AnimatePresence mode="wait">
                <motion.p
                  key={LOADING_LINES[line]}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="font-mono text-sm tracking-wide text-[#e8fbff]"
                >
                  {LOADING_LINES[line]}
                </motion.p>
              </AnimatePresence>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full bg-cyan"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                  style={{ width: "40%" }}
                />
              </div>
            </motion.div>
          ) : game ? (
            <motion.div
              key="play"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-hidden"
            >
              <GameFrame html={game.html} title={title || "Preview"} />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
            >
              <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_2px,rgba(0,0,0,.18)_2px_3px)]" />
              <p className="font-mono text-sm tracking-[0.2em] text-cyan/70">INSERT PROMPT</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Generate a ROM and it plays here — then launch the coin underneath.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {game && !generating ? (
        <div>
          <div className="flex items-center justify-between gap-3 border-t border-white/5 px-3 py-2 text-xs">
            <span className="truncate text-muted-foreground">
              {game.bytes} raw · {game.compressedBytes} gzipped · {game.mechanic ?? game.genre}
            </span>
            <span className={overLimit ? "text-negative" : "text-positive"}>
              {meter}% of {MAX_GAME_BYTES} gzip cap
            </span>
          </div>
          <div className="h-1 bg-muted">
            <div
              className={cn("h-full", overLimit ? "bg-negative" : "bg-positive")}
              style={{ width: `${meter}%` }}
            />
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

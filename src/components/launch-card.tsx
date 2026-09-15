"use client";

import { Play, RefreshCw, Share2 } from "lucide-react";

import { GENRES, PUMP_FUN_COIN_URL } from "@/lib/constants";
import { formatPct, formatUsd, formatVolume, hashHue, sparklinePath, ticker } from "@/lib/format";
import type { OcgLaunch } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FilterChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted-foreground">Genre</span>
      {GENRES.map((genre) => {
        const active = value === genre;
        return (
          <button
            key={genre}
            type="button"
            onClick={() => onChange(genre)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              active
                ? "border-primary/40 bg-[#1a3338] text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}

export function LaunchCard({
  launch,
  onPlay,
}: {
  launch: OcgLaunch;
  onPlay: (launch: OcgLaunch) => void;
}) {
  const hue = hashHue(launch.symbol + launch.name);
  const up = (launch.change24h ?? 0) >= 0;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div
        className="pointer-events-none absolute -right-6 -bottom-10 size-44 rounded-full opacity-80"
        style={{
          background: `radial-gradient(circle, hsla(${hue}, 35%, 28%, 0.9) 0%, transparent 68%)`,
        }}
      />
      <div
        className="pointer-events-none absolute right-4 bottom-4 flex size-24 items-center justify-center rounded-full border border-white/5 bg-black/20 text-4xl opacity-80"
        aria-hidden
      >
        {launch.symbol.slice(0, 1)}
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold"
            style={{ background: `hsl(${hue} 30% 18%)` }}
          >
            {launch.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={launch.image} alt="" className="size-full object-cover" />
            ) : (
              launch.symbol.slice(0, 2)
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <IconButton
            label="Share"
            onClick={() => {
              const url = launch.mint
                ? `${PUMP_FUN_COIN_URL}/${launch.mint}`
                : window.location.origin;
              void navigator.clipboard.writeText(url);
            }}
          >
            <Share2 className="size-3.5" />
          </IconButton>
          <IconButton label="Refresh" onClick={() => onPlay(launch)}>
            <RefreshCw className="size-3.5" />
          </IconButton>
          <button
            type="button"
            className="rounded-md px-1.5 py-1 text-[11px] tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => {
              if (launch.mint) void navigator.clipboard.writeText(launch.mint);
            }}
          >
            CA
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        <p className="text-sm text-muted-foreground">{ticker(launch.symbol)}</p>
        <h3 className="mt-0.5 text-sm text-muted-foreground/90">{launch.name}</h3>
        <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight">
          {launch.demo ? formatUsd(launch.marketCapUsd) : launch.mint ? formatUsd(launch.marketCapUsd ?? 0) : "New"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Playable on</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground">SOL</span>
          <span className="rounded-full bg-[#1d3d32] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-positive uppercase">
            {launch.genre}
          </span>
          {launch.demo ? (
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              DEMO
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {formatVolume(launch.volumeUsd)}
          <span className={cn("ml-2", up ? "text-positive" : "text-negative")}>
            {formatPct(launch.change24h)}
          </span>
        </div>
        <svg viewBox="0 0 88 28" className="h-7 w-20" aria-hidden>
          <path
            d={sparklinePath(launch.sparkline, 88, 28)}
            fill="none"
            stroke={up ? "#3ddc8e" : "#f07178"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <button
        type="button"
        onClick={() => onPlay(launch)}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
        aria-label={`Play ${launch.name}`}
      />
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/0 opacity-0 transition group-hover:bg-background/20 group-hover:opacity-100">
        <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-lg">
          <Play className="size-3.5 fill-current" /> Play
        </span>
      </div>
    </article>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative z-20 rounded-md p-1 hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

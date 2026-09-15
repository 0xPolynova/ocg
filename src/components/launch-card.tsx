"use client";

import { useState } from "react";
import { Check, Copy, Play, RefreshCw, Share2 } from "lucide-react";

import { GENRES, PUMP_FUN_COIN_URL } from "@/lib/constants";
import { formatPct, formatUsd, hashHue, ticker } from "@/lib/format";
import { publicPlayUrl, launchSlug } from "@/lib/site";
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
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto" role="group" aria-label="Filter by genre">
      <span className="mr-1 shrink-0 text-sm text-muted-foreground">Genre</span>
      {GENRES.map((genre) => {
        const active = value === genre;
        return (
          <button
            key={genre}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(genre)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-[#1a3338] text-foreground"
                : "border-border text-muted-foreground hover:border-primary/50 hover:bg-white/4 hover:text-foreground",
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
  onRefresh,
}: {
  launch: OcgLaunch;
  onPlay: (launch: OcgLaunch) => void;
  onRefresh?: (launch: OcgLaunch) => void;
}) {
  const hue = hashHue(launch.symbol + launch.name);
  const up = (launch.change24h ?? 0) >= 0;
  const [copied, setCopied] = useState<"share" | "ca" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function shareUrl(): string {
    if (launch.mint) return `${PUMP_FUN_COIN_URL}/${launch.mint}`;
    return launch.playUrl ?? publicPlayUrl(launchSlug(launch));
  }

  async function copy(kind: "share" | "ca", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard may be blocked */
    }
  }

  async function refresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh(launch);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <article className="group isolate relative min-h-[188px] overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:border-[#2a4a4e] hover:bg-[#0e1b1e] sm:min-h-[232px] sm:p-5">
      <div className="pointer-events-none absolute -right-3 -bottom-6 size-32 rounded-full border border-border bg-card p-3 sm:-right-4 sm:-bottom-8 sm:size-44 sm:p-4">
        <div className="grid size-full place-items-center overflow-hidden rounded-full border border-white/6 bg-[#132225]">
          {launch.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={launch.image}
              alt=""
              className="size-[72%] rounded-full object-cover opacity-60 saturate-[0.8]"
            />
          ) : (
            <span className="text-3xl font-semibold text-primary/80">{launch.symbol.slice(0, 1)}</span>
          )}
        </div>
      </div>

      <div className="relative z-30 flex items-start justify-between gap-4">
        <div
          className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-[#163034] text-sm font-semibold"
          style={launch.image ? undefined : { background: `hsl(${hue} 28% 16%)` }}
        >
          {launch.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={launch.image} alt="" className="size-full object-cover" />
          ) : (
            launch.symbol.slice(0, 2)
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onPlay(launch)}
            className="inline-flex h-[26px] items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground sm:hidden"
          >
            <Play className="size-3 fill-current" />
            Play
          </button>
          <IconButton
            label="Share"
            onClick={() => void copy("share", shareUrl())}
          >
            {copied === "share" ? <Check className="size-3.5 text-positive" /> : <Share2 className="size-3.5" />}
          </IconButton>
          <IconButton label="Refresh" onClick={() => void refresh()}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          </IconButton>
          <button
            type="button"
            title="Copy contract address"
            aria-label="Copy contract address"
            onClick={() => {
              if (launch.mint) void copy("ca", launch.mint);
            }}
            className="inline-flex h-[26px] shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border bg-card/80 px-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:border-primary/60 hover:bg-[#132225] hover:text-foreground"
          >
            CA
            {copied === "ca" ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-4 max-w-[74%] sm:mt-7 sm:max-w-[68%]">
        <p className="truncate text-xs font-semibold text-primary">{ticker(launch.symbol)}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{launch.name}</p>
        <p className="mt-1.5 text-[26px] font-semibold tracking-[-0.045em] sm:mt-2 sm:text-3xl">
          {launch.marketCapUsd
            ? formatUsd(launch.marketCapUsd)
            : launch.mint
              ? "New"
              : "—"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span>Paired with</span>
          <span className="inline-grid size-4 place-items-center rounded-full bg-[#1a3338] text-[6px] font-bold text-foreground">
            S
          </span>
          <span className="font-medium text-foreground/80">SOL</span>
          <span className="rounded-full border border-positive/30 bg-positive/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-positive uppercase">
            {launch.genre}
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex max-w-[78%] items-center gap-4 border-t border-border pt-3 text-[11px] text-muted-foreground sm:mt-5 sm:max-w-[72%]">
        <span>Vol {launch.volumeUsd ? formatUsd(launch.volumeUsd) : "—"}</span>
        {launch.change24h !== undefined ? (
          <span className={up ? "text-positive" : "text-negative"}>{formatPct(launch.change24h)}</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onPlay(launch)}
        className="absolute top-1/2 left-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-lg transition-opacity sm:flex sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100"
      >
        <Play className="size-3.5 fill-current" />
        Play
      </button>
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
      title={label}
      onClick={onClick}
      className="inline-grid size-[26px] shrink-0 place-items-center rounded-full border border-border bg-card/80 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-[#132225] hover:text-foreground"
    >
      {children}
    </button>
  );
}

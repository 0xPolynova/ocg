"use client";

import { ExternalLink, X } from "lucide-react";

import { GameFrame } from "@/components/game-frame";
import { PUMP_FUN_COIN_URL, SOLSCAN_TX_URL, solscanTokenUrl } from "@/lib/constants";
import { formatUsd, shortAddress, ticker } from "@/lib/format";
import { launchSlug, playPath, publicPlayUrl } from "@/lib/site";
import type { OcgLaunch } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlayModal({
  launch,
  onClose,
  variant = "overlay",
}: {
  launch: OcgLaunch;
  onClose?: () => void;
  variant?: "overlay" | "page";
}) {
  const page = variant === "page";

  if (page) {
    return <PlayPage launch={launch} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[min(92vh,920px)] min-h-[min(72vh,680px)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl md:flex-row">
        <div className="relative min-h-[320px] w-full flex-1 bg-[#041014]">
          <GameFrame html={launch.gameHtml} title={launch.name} />
        </div>
        <PlayMeta launch={launch} onClose={onClose} compact />
      </div>
    </div>
  );
}

function PlayPage({ launch }: { launch: OcgLaunch }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[min(72vh,860px)] min-h-[420px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="absolute inset-0 bg-[#041014]">
          <GameFrame html={launch.gameHtml} title={launch.name} />
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <PlayMeta launch={launch} />
      </div>
    </div>
  );
}

function PlayMeta({
  launch,
  onClose,
  compact = false,
}: {
  launch: OcgLaunch;
  onClose?: () => void;
  compact?: boolean;
}) {
  const slug = launchSlug(launch);
  const playUrl = launch.playUrl ?? publicPlayUrl(slug);
  const tx = launch.createSignature ?? launch.storeSignatures[0];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-5",
        compact ? "w-full shrink-0 md:w-[340px] md:overflow-y-auto" : "md:flex-row md:items-start md:justify-between",
      )}
    >
      <div className={cn("min-w-0", !compact && "max-w-xl")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{ticker(launch.symbol)}</p>
            <h2 className="mt-0.5 truncate text-lg font-semibold">{launch.name}</h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{launch.description}</p>
        <dl className="mt-4 grid gap-2 text-sm">
          <Row label="Genre" value={launch.genre} />
          <Row label="Size" value={`${launch.gameBytes} bytes`} />
          <Row label="Market cap" value={formatUsd(launch.marketCapUsd)} />
          <Row label="Mint" value={shortAddress(launch.mint, 6)} />
          <Row label="Play URL" value={playUrl ? `launchocg.com/${slug}` : launch.demo ? "Demo" : "Local"} />
        </dl>
      </div>

      <div className={cn("flex flex-col gap-2", compact ? "mt-auto" : "w-full max-w-sm shrink-0 md:pt-1")}>
        {launch.mint && compact ? (
          <PlayLink href={playPath(slug)} label="Open play page" />
        ) : null}
        {launch.mint ? (
          <>
            <PlayLink href={`${PUMP_FUN_COIN_URL}/${launch.mint}`} label="Pump.fun" external primary />
            <PlayLink href={solscanTokenUrl(launch.mint)} label="Solscan" external />
            {tx ? <PlayLink href={`${SOLSCAN_TX_URL}/${tx}`} label="Game tx" external /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Demo games are playable here. Create a game to host it on OCG and launch a real Pump.fun token.
          </p>
        )}
      </div>
    </div>
  );
}

function PlayLink({
  href,
  label,
  external = false,
  primary = false,
}: {
  href: string;
  label: string;
  external?: boolean;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium",
        primary
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted",
      )}
    >
      {label}
      {external ? <ExternalLink className="size-3.5" /> : null}
    </a>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

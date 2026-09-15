"use client";

import { ExternalLink, X } from "lucide-react";

import { GameFrame } from "@/components/game-frame";
import { PUMP_FUN_COIN_URL } from "@/lib/constants";
import { formatUsd, shortAddress, ticker } from "@/lib/format";
import type { OcgLaunch } from "@/lib/types";

export function PlayModal({
  launch,
  onClose,
}: {
  launch: OcgLaunch;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl md:grid-cols-[1.4fr_0.8fr]">
        <div className="relative aspect-[16/10] w-full bg-[#041014]">
          <GameFrame html={launch.gameHtml} title={launch.name} />
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{ticker(launch.symbol)}</p>
              <h2 className="text-xl font-semibold">{launch.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{launch.description}</p>
          <dl className="grid gap-2 text-sm">
            <Row label="Genre" value={launch.genre} />
            <Row label="On-chain size" value={`${launch.compressedBytes} bytes`} />
            <Row label="Market cap" value={formatUsd(launch.marketCapUsd)} />
            <Row label="Mint" value={shortAddress(launch.mint, 6)} />
            <Row
              label="Inscription"
              value={
                launch.storeSignatures[0]
                  ? shortAddress(launch.storeSignatures[0], 6)
                  : launch.demo
                    ? "Demo"
                    : "Local"
              }
            />
          </dl>
          {launch.mint ? (
            <a
              href={`${PUMP_FUN_COIN_URL}/${launch.mint}`}
              target="_blank"
              rel="noreferrer"
              className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground"
            >
              View on Pump.fun <ExternalLink className="size-4" />
            </a>
          ) : (
            <p className="mt-auto text-xs text-muted-foreground">
              Demo games are playable here. Create a game to inscribe it on Solana and launch a real
              Pump.fun token.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

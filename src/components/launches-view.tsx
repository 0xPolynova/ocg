"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { FilterChips, LaunchCard } from "@/components/launch-card";
import { PlayModal } from "@/components/play-modal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { hydrateLaunches, readLaunches, subscribeLaunches, getEmptyLaunches } from "@/lib/launches-store";
import { fetchPumpStats } from "@/lib/pump-launch";
import { SEED_LAUNCHES } from "@/lib/seed-games";
import type { OcgLaunch } from "@/lib/types";

export function LaunchesView() {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const stored = useSyncExternalStore(subscribeLaunches, readLaunches, getEmptyLaunches);
  const [stats, setStats] = useState<Record<string, Partial<OcgLaunch>>>({});
  const [playing, setPlaying] = useState<OcgLaunch | null>(null);
  const mintKey = stored.map((item) => item.mint ?? "").join("|");

  useEffect(() => {
    void hydrateLaunches();
  }, []);

  useEffect(() => {
    const mints = mintKey.split("|").filter(Boolean);
    if (mints.length === 0) return;
    let cancelled = false;
    void Promise.all(
      mints.map(async (mint) => {
        const coin = await fetchPumpStats(mint);
        return [mint, coin] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, Partial<OcgLaunch>> = {};
      for (const [mint, coin] of entries) {
        if (!coin) continue;
        next[mint] = {
          marketCapUsd: coin.usd_market_cap ?? coin.market_cap,
          volumeUsd: coin.volume_24h,
          change24h: coin.price_change_24h,
        };
      }
      setStats(next);
    });
    return () => {
      cancelled = true;
    };
  }, [mintKey]);

  const local = useMemo(
    () =>
      stored.map((item) =>
        item.mint && stats[item.mint] ? { ...item, ...stats[item.mint] } : item,
      ),
    [stats, stored],
  );

  const launches = useMemo(() => {
    const merged = [
      ...local,
      ...SEED_LAUNCHES.filter((seed) => !local.some((item) => item.id === seed.id)),
    ];
    return merged.filter((launch) => {
      const matchesGenre = genre === "All" || launch.genre === genre;
      const haystack = `${launch.name} ${launch.symbol} ${launch.description}`.toLowerCase();
      return matchesGenre && haystack.includes(query.toLowerCase());
    });
  }, [genre, local, query]);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader query={query} onQueryChange={setQuery} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 md:px-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Launch games paired with SOL</h1>
          <p className="mt-2 text-muted-foreground">
            Create and discover playable games. Each launch hosts the game on OCG and mints a
            Pump.fun token whose metadata points at the play URL.
          </p>
        </div>

        <div className="mt-8">
          <FilterChips value={genre} onChange={setGenre} />
        </div>

        <h2 className="mt-8 mb-4 text-lg font-medium">
          {genre === "All" ? "All games" : genre}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {launches.map((launch) => (
            <LaunchCard key={launch.id} launch={launch} onPlay={setPlaying} />
          ))}
        </div>
      </main>
      <SiteFooter />
      {playing ? <PlayModal launch={playing} onClose={() => setPlaying(null)} /> : null}
    </div>
  );
}

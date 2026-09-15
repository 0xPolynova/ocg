"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { FilterChips, LaunchCard } from "@/components/launch-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  fetchMarketCaps,
  hydrateLaunches,
  readLaunches,
  subscribeLaunches,
  getEmptyLaunches,
} from "@/lib/launches-store";
import type { OcgLaunch } from "@/lib/types";

export function LaunchesView() {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const stored = useSyncExternalStore(subscribeLaunches, readLaunches, getEmptyLaunches);
  const [stats, setStats] = useState<Record<string, Partial<OcgLaunch>>>({});

  const loadCaps = useCallback(async () => {
    const next = await fetchMarketCaps();
    setStats(next);
  }, []);

  async function refreshLaunch() {
    await hydrateLaunches();
    await loadCaps();
  }

  useEffect(() => {
    void hydrateLaunches();
    void loadCaps();
    const timer = window.setInterval(() => {
      void loadCaps();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadCaps]);

  const local = useMemo(
    () =>
      stored.map((item) =>
        item.mint && stats[item.mint] ? { ...item, ...stats[item.mint] } : item,
      ),
    [stats, stored],
  );

  const launches = useMemo(() => {
    return local.filter((launch) => {
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
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Launch games</h1>
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
          {launches.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-dashed border-border px-5 py-10 text-sm text-muted-foreground">
              No games launched yet.{" "}
              <Link href="/create" className="text-foreground underline underline-offset-4">
                Create the first one
              </Link>
              .
            </p>
          ) : (
            launches.map((launch) => (
              <LaunchCard
                key={launch.id}
                launch={launch}
                onRefresh={() => void refreshLaunch()}
              />
            ))
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

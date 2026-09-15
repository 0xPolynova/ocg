"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { PlayModal } from "@/components/play-modal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { fetchLaunch, getEmptyLaunches, readLaunches, subscribeLaunches } from "@/lib/launches-store";
import { launchSlug } from "@/lib/site";
import type { OcgLaunch } from "@/lib/types";

function matchesLaunch(launch: OcgLaunch, key: string): boolean {
  const needle = key.toLowerCase();
  return (
    launch.id.toLowerCase() === needle ||
    launch.mint?.toLowerCase() === needle ||
    launch.symbol.toLowerCase() === needle ||
    launchSlug(launch).toLowerCase() === needle
  );
}

export function PlayByKey({ lookup }: { lookup: string }) {
  const local = useSyncExternalStore(subscribeLaunches, readLaunches, getEmptyLaunches);
  const [remote, setRemote] = useState<OcgLaunch | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchLaunch(lookup).then((launch) => {
      if (!cancelled) setRemote(launch);
    });
    return () => {
      cancelled = true;
    };
  }, [lookup]);

  const launch = useMemo(() => {
    return (
      remote ?? local.find((item) => matchesLaunch(item, lookup)) ?? null
    );
  }, [local, lookup, remote]);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6">
        {launch ? (
          <PlayModal launch={launch} variant="page" />
        ) : (
          <p className="text-muted-foreground">Game not found.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";

import { PlayModal } from "@/components/play-modal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { fetchLaunch, getEmptyLaunches, readLaunches, subscribeLaunches } from "@/lib/launches-store";
import { SEED_LAUNCHES } from "@/lib/seed-games";
import type { OcgLaunch } from "@/lib/types";

export default function PlayPage() {
  const params = useParams<{ mint: string }>();
  const local = useSyncExternalStore(subscribeLaunches, readLaunches, getEmptyLaunches);
  const [remote, setRemote] = useState<OcgLaunch | null>(null);
  const mint = params.mint;

  useEffect(() => {
    let cancelled = false;
    void fetchLaunch(mint).then((launch) => {
      if (!cancelled) setRemote(launch);
    });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  const launch = useMemo(() => {
    return (
      remote ??
      [...local, ...SEED_LAUNCHES].find(
        (item) => item.mint === mint || item.id === mint || item.symbol === mint,
      ) ??
      null
    );
  }, [local, mint, remote]);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center p-6">
        {launch ? (
          <PlayModal launch={launch} onClose={() => history.back()} />
        ) : (
          <p className="text-muted-foreground">Game not found.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

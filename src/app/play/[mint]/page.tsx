"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";

import { PlayModal } from "@/components/play-modal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getEmptyLaunches, readLaunches, subscribeLaunches } from "@/lib/launches-store";
import { SEED_LAUNCHES } from "@/lib/seed-games";

export default function PlayPage() {
  const params = useParams<{ mint: string }>();
  const local = useSyncExternalStore(subscribeLaunches, readLaunches, getEmptyLaunches);
  const launch = useMemo(() => {
    const mint = params.mint;
    return (
      [...local, ...SEED_LAUNCHES].find(
        (item) => item.mint === mint || item.id === mint || item.symbol === mint,
      ) ?? null
    );
  }, [local, params.mint]);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center p-6">
        {launch ? (
          <PlayModal launch={launch} onClose={() => history.back()} />
        ) : (
          <p className="text-muted-foreground">Game not found in this browser yet.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

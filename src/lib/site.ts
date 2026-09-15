import type { OcgLaunch } from "@/lib/types";

/** Canonical public origin written into Pump.fun metadata. */
export const PUBLIC_SITE_URL = "https://launchocg.com";

const RESERVED_SLUGS = new Set([
  "create",
  "launches",
  "play",
  "api",
  "rpc",
  "images",
  "videos",
  "seo",
  "logos",
  "favicon",
  "robots",
  "sitemap",
  "icon",
  "apple-icon",
  "manifest",
]);

export function tickerSlug(symbol: string): string {
  const raw = symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
  return raw || "GAME";
}

export function playPath(slug: string): string {
  return `/${slug}`;
}

export function publicPlayUrl(slug: string): string {
  return `${PUBLIC_SITE_URL}${playPath(slug)}`;
}

function shortMint(mint: string): string {
  return mint.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
}

function isReserved(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export async function allocatePlaySlug(
  symbol: string,
  mint: string,
  lookup: (id: string) => Promise<OcgLaunch | null>,
): Promise<string> {
  const base = tickerSlug(symbol);
  const preferred = isReserved(base) ? `${base}-${shortMint(mint)}` : base;
  const existing = await lookup(preferred);
  if (!existing || existing.mint === mint || existing.id === mint) return preferred;
  return `${base}-${shortMint(mint)}`;
}

export function launchSlug(launch: Pick<OcgLaunch, "slug" | "symbol" | "mint" | "id">): string {
  return launch.slug || tickerSlug(launch.symbol) || launch.mint || launch.id;
}

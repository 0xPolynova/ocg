/** Canonical public origin written into Pump.fun metadata. */
export const PUBLIC_SITE_URL = "https://launchocg.com";

export function publicPlayUrl(mint: string): string {
  return `${PUBLIC_SITE_URL}/play/${mint}`;
}

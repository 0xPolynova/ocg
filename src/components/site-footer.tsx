import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted-foreground md:px-6">
        <Link href="/" className="inline-flex items-center">
          <BrandLogo className="h-6 w-auto" />
        </Link>
        <Link href="/" className="hover:text-foreground">
          Launches
        </Link>
        <Link href="/create" className="hover:text-foreground">
          Create
        </Link>
        <a href="https://pump.fun" className="hover:text-foreground" target="_blank" rel="noreferrer">
          Pump.fun
        </a>
        <span className="ml-auto">Games inscribed on Solana · tokens on Pump.fun</span>
      </div>
    </footer>
  );
}

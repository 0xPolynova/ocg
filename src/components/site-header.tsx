"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Search } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { APP_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SiteHeader({
  query,
  onQueryChange,
}: {
  query?: string;
  onQueryChange?: (value: string) => void;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <BrandLogo priority className="h-8 w-auto" />
          <span className="hidden text-xs text-muted-foreground sm:inline">{APP_TAGLINE}</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/" active={pathname === "/" || pathname === "/launches"}>
            Launches
          </NavLink>
          <NavLink href="/create" active={pathname === "/create"}>
            Create
          </NavLink>
        </nav>

        {onQueryChange ? (
          <label className="relative mx-auto hidden min-w-0 flex-1 max-w-md lg:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search games"
              className="h-9 w-full rounded-full border border-border bg-card/80 pr-12 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
            <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-border px-1.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </label>
        ) : (
          <div className="flex-1" />
        )}

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/create"
            className="hidden h-9 items-center rounded-full border border-border px-3 text-sm text-foreground hover:bg-muted md:inline-flex"
          >
            Launch game
          </Link>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

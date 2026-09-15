"use client";

import "@/lib/polyfills";
import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

import { WalletUiProvider } from "@/components/wallet-ui";

export function WalletProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [], []);
  const endpoint = useMemo(() => {
    if (typeof window === "undefined") return "https://ocg-api.onrender.com/rpc";
    return `${window.location.origin}/rpc`;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletUiProvider>{children}</WalletUiProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

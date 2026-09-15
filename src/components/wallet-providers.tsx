"use client";

import "@/lib/polyfills";
import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

import { WalletUiProvider } from "@/components/wallet-ui";
import { HELIUS_RPC_HTTP, HELIUS_RPC_WSS } from "@/lib/solana-rpc";

export function WalletProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [], []);
  const config = useMemo(
    () => ({
      commitment: "confirmed" as const,
      wsEndpoint: HELIUS_RPC_WSS,
    }),
    [],
  );

  return (
    <ConnectionProvider endpoint={HELIUS_RPC_HTTP} config={config}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletUiProvider>{children}</WalletUiProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

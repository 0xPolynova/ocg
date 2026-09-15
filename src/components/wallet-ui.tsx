"use client";

import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, Unplug, Wallet as WalletIcon, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

type WalletUiValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const WalletUiContext = createContext<WalletUiValue | null>(null);

export function WalletUiProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { connected } = useWallet();

  useEffect(() => {
    if (connected) setOpen(false);
  }, [connected]);

  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <WalletUiContext.Provider value={value}>
      {children}
      <WalletModal />
    </WalletUiContext.Provider>
  );
}

function useWalletUi() {
  const ctx = useContext(WalletUiContext);
  if (!ctx) throw new Error("WalletUiProvider is missing.");
  return ctx;
}

function sortWallets(wallets: Wallet[]) {
  const rank = (wallet: Wallet) => {
    if (wallet.readyState === WalletReadyState.Installed) return 0;
    if (wallet.readyState === WalletReadyState.Loadable) return 1;
    return 2;
  };
  return [...wallets].sort((a, b) => rank(a) - rank(b) || a.adapter.name.localeCompare(b.adapter.name));
}

export function WalletButton({
  fullWidth = false,
  connectLabel = "Select wallet",
}: {
  fullWidth?: boolean;
  connectLabel?: string;
}) {
  const { connected, connecting, publicKey, disconnect, wallet } = useWallet();
  const { setOpen } = useWalletUi();
  const [mounted, setMounted] = useState(false);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenu(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [menu]);

  const address = publicKey?.toBase58() ?? "";

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const shell = cn(
    "inline-flex items-center justify-center gap-2 font-medium transition-colors",
    fullWidth ? "h-11 w-full rounded-xl text-sm" : "h-9 rounded-full px-3 text-sm",
  );

  if (!mounted) {
    return (
      <span
        className={cn(shell, "border border-border bg-card text-muted-foreground")}
        aria-hidden
      >
        {connectLabel}
      </span>
    );
  }

  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={connecting}
        className={cn(
          shell,
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
        )}
      >
        <WalletIcon className="size-4" />
        {connecting ? "Connecting…" : connectLabel}
      </button>
    );
  }

  return (
    <div ref={root} className={cn("relative", fullWidth && "w-full")}>
      <button
        type="button"
        onClick={() => setMenu((value) => !value)}
        className={cn(
          shell,
          "border border-border bg-card text-foreground hover:bg-muted",
          fullWidth && "px-4",
        )}
      >
        {wallet?.adapter.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" className="size-4 rounded-sm" />
        ) : (
          <span className="size-2 rounded-full bg-positive" />
        )}
        <span className="font-mono text-[13px]">{shortAddress(address, 4)}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {menu ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={cn(
              "absolute z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-2xl",
              fullWidth ? "inset-x-0" : "right-0 w-52",
            )}
          >
            <button
              type="button"
              onClick={() => void copy()}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {copied ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy address"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                void disconnect();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Unplug className="size-4" />
              Disconnect
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function WalletModal() {
  const { open, setOpen } = useWalletUi();
  const { wallets, select, connect, connecting } = useWallet();
  const [pending, setPending] = useState<WalletName | null>(null);
  const listed = useMemo(() => sortWallets(wallets), [wallets]);

  const pick = useCallback(
    (wallet: Wallet) => {
      if (wallet.readyState === WalletReadyState.NotDetected) {
        window.open(wallet.adapter.url, "_blank", "noreferrer");
        return;
      }
      setPending(wallet.adapter.name);
      select(wallet.adapter.name);
      window.setTimeout(() => {
        void connect().catch(() => undefined);
      }, 0);
    },
    [connect, select],
  );

  useEffect(() => {
    if (!open) setPending(null);
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close wallet picker"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="ocg-wallet-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <p id="ocg-wallet-title" className="text-base font-semibold">
                  Select wallet
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Connect to launch on Pump.fun and inscribe the ROM.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[min(420px,60vh)] space-y-1 overflow-y-auto p-3">
              {listed.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No Solana wallets found. Install Phantom or Solflare, then refresh.
                </p>
              ) : (
                listed.map((wallet) => {
                  const installed = wallet.readyState === WalletReadyState.Installed;
                  const busy = connecting && pending === wallet.adapter.name;
                  return (
                    <button
                      key={wallet.adapter.name}
                      type="button"
                      onClick={() => pick(wallet)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left hover:border-border hover:bg-muted/70"
                    >
                      <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-muted">
                        {wallet.adapter.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={wallet.adapter.icon} alt="" className="size-6" />
                        ) : (
                          <WalletIcon className="size-4 text-cyan" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{wallet.adapter.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {installed ? "Detected" : "Install to connect"}
                        </span>
                      </span>
                      {busy ? (
                        <span className="text-xs text-cyan">Connecting…</span>
                      ) : installed ? (
                        <span className="rounded-full bg-positive/15 px-2 py-0.5 text-[10px] font-medium tracking-wide text-positive uppercase">
                          Ready
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Get</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

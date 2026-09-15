"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Lock, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { RomCabinet } from "@/components/rom-cabinet";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WalletButton } from "@/components/wallet-ui";
import { apiUrl } from "@/lib/api";
import { inscribeGame } from "@/lib/chain-store";
import { MAX_GAME_BYTES } from "@/lib/constants";
import { utf8Bytes } from "@/lib/game-codec";
import { upsertLaunch } from "@/lib/launches-store";
import {
  formatTokenAmount,
  PUMP_MAX_CURVE_PCT,
  PUMP_MAX_SOL_BUY,
  solForSupplyPct,
  supplyPctForSol,
} from "@/lib/pump-curve";
import { createPumpToken, uploadPumpMetadata } from "@/lib/pump-launch";
import type { GenerateGameResponse, OcgLaunch } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CreateStudio() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();

  const [prompt, setPrompt] = useState(
    "Neon snake in a shrinking box — eat bits, don't hit the tail",
  );
  const [busy, setBusy] = useState<"generate" | "launch" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GenerateGameResponse | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [mayhemMode, setMayhemMode] = useState(false);
  const [buyMode, setBuyMode] = useState<"pct" | "sol">("sol");
  const [solBuy, setSolBuy] = useState(0);

  const generating = busy === "generate";
  const showLaunch = Boolean(game) && !generating;
  const compressed = game?.compressedBytes ?? 0;
  const overLimit = compressed > MAX_GAME_BYTES;
  const pct = useMemo(() => supplyPctForSol(solBuy), [solBuy]);
  const sliderValue = buyMode === "sol" ? solBuy : pct;
  const sliderMax = buyMode === "sol" ? PUMP_MAX_SOL_BUY : PUMP_MAX_CURVE_PCT;
  const sliderStep = buyMode === "sol" ? 0.01 : 0.1;

  async function generate() {
    setBusy("generate");
    setError(null);
    setStatus(null);
    setGame(null);
    setName("");
    setSymbol("");
    try {
      const response = await fetch(apiUrl("/api/generate-game"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = (await response.json()) as GenerateGameResponse & { error?: string };
      if (!response.ok && !json.html) throw new Error(json.error ?? "Could not generate a game.");
      setGame(json);
      setName(json.name);
      setSymbol(json.symbol);
      setDescription(prompt.slice(0, 200));
      if (!website && typeof window !== "undefined") setWebsite(window.location.origin);
      setStatus(json.fallback ? json.error ?? "Used a compact fallback ROM." : "ROM ready. Play it, then launch.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed.";
      setError(
        message === "Failed to fetch"
          ? "Could not reach the game API. Check that ocg-api is live."
          : message,
      );
    } finally {
      setBusy(null);
    }
  }

  async function launch() {
    if (!game) return;
    if (overLimit) {
      setError("This ROM is too large to inscribe in a Solana transaction.");
      return;
    }
    if (!wallet.publicKey) {
      setError("Connect a wallet to launch on Pump.fun.");
      return;
    }

    setBusy("launch");
    setError(null);
    try {
      setStatus("Uploading token metadata…");
      const uri = await uploadPumpMetadata({
        name,
        symbol,
        description: description || `OCG · ${prompt.slice(0, 160)}`,
        image,
        website,
        twitter,
        telegram,
      });

      setStatus("Creating Pump.fun token…");
      const created = await createPumpToken({
        connection,
        wallet,
        name,
        symbol,
        uri,
        solBuy,
        mayhemMode,
      });

      setStatus("Inscribing game on Solana…");
      const storeSignatures = await inscribeGame({
        connection,
        wallet,
        mint: created.mint,
        html: game.html,
      });

      const record: OcgLaunch = {
        id: created.mint.toBase58(),
        name,
        symbol,
        description: description || prompt,
        prompt,
        genre: game.genre,
        gameHtml: game.html,
        gameBytes: utf8Bytes(game.html),
        compressedBytes: game.compressedBytes,
        mint: created.mint.toBase58(),
        creator: wallet.publicKey.toBase58(),
        storeSignatures,
        createSignature: created.signature,
        createdAt: Date.now(),
        sparkline: [1, 2, 2, 3, 4, 4, 6, 7, 8, 9, 11, 13],
        marketCapUsd: solBuy * 150,
        volumeUsd: solBuy * 80,
        change24h: 0,
      };
      await upsertLaunch(record);
      setStatus("Launched. Your game is live on Launches.");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed.");
      setStatus(null);
    } finally {
      setBusy(null);
    }
  }

  function onBuySlider(value: number) {
    if (buyMode === "sol") setSolBuy(value);
    else setSolBuy(solForSupplyPct(value));
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 md:px-6">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight">Create a game</h1>
          <p className="mt-2 text-muted-foreground">
            Prompt a real micro-arcade. The ROM plays in the cabinet, then you launch the Pump.fun
            coin underneath.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <Field label="Prompt">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                  placeholder="A microscopic snake game with neon walls"
                />
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {PROMPTS.map((idea) => (
                  <button
                    key={idea.label}
                    type="button"
                    onClick={() => setPrompt(idea.prompt)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    {idea.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void generate()}
                disabled={busy !== null || prompt.trim().length < 3}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
              >
                <Wand2 className="size-4" />
                {generating ? "Building ROM…" : game ? "Regenerate" : "Generate game"}
              </button>
            </section>

            <RomCabinet game={game} generating={generating} title={name || "Preview"} />

            <AnimatePresence>
              {showLaunch ? (
                <motion.section
                  key="launch-form"
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-2xl border border-border bg-card p-5 md:p-6"
                >
                  <h2 className="text-sm font-medium">Launch coin</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Same fields as Pump.fun create — name, ticker, and image lock in at mint.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Token name">
                      <input
                        value={name}
                        maxLength={32}
                        onChange={(event) => setName(event.target.value)}
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>
                    <Field label="Ticker">
                      <input
                        value={symbol}
                        maxLength={10}
                        onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Description">
                      <textarea
                        value={description}
                        maxLength={200}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={3}
                        className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Token image">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                        className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
                      />
                    </Field>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Square PNG/JPG, ideally 1000×1000. Immutable after create.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Field label="Website">
                      <input
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                        placeholder="https://"
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>
                    <Field label="X / Twitter">
                      <input
                        value={twitter}
                        onChange={(event) => setTwitter(event.target.value)}
                        placeholder="https://x.com/…"
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>
                    <Field label="Telegram">
                      <input
                        value={telegram}
                        onChange={(event) => setTelegram(event.target.value)}
                        placeholder="https://t.me/…"
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Socials can only be set at creation on Pump.fun.
                  </p>

                  <label className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-background/60 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={mayhemMode}
                      onChange={(event) => setMayhemMode(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium">Mayhem mode</span>
                      <span className="text-xs text-muted-foreground">
                        24h AI trading agent, only set at create. Can increase supply. Same starting
                        market cap.
                      </span>
                    </span>
                  </label>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Dev buy</p>
                      <div className="flex rounded-full border border-border p-0.5 text-xs">
                        <Toggle active={buyMode === "sol"} onClick={() => setBuyMode("sol")}>
                          SOL
                        </Toggle>
                        <Toggle active={buyMode === "pct"} onClick={() => setBuyMode("pct")}>
                          % of supply
                        </Toggle>
                      </div>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Optional first buy on the bonding curve, bundled with create. Pump.fun prices
                      this on the curve — 10% of supply is about {solForSupplyPct(10).toFixed(2)} SOL,
                      not a flat split of 2 SOL.
                    </p>
                    <input
                      className="ocg-slider"
                      type="range"
                      min={0}
                      max={sliderMax}
                      step={sliderStep}
                      value={sliderValue}
                      onChange={(event) => onBuySlider(Number(event.target.value))}
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">0</span>
                      <span className="font-medium text-foreground">
                        {solBuy.toFixed(3)} SOL · {pct.toFixed(2)}% of 1B
                        {solBuy > 0 ? ` · ~${formatTokenAmount(solBuy)} tokens` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {buyMode === "sol" ? `${PUMP_MAX_SOL_BUY} SOL` : `${PUMP_MAX_CURVE_PCT}%`}
                      </span>
                    </div>
                  </div>
                </motion.section>
              ) : null}
            </AnimatePresence>
          </div>

          <aside className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
            <h2 className="text-sm font-medium">Launch summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Summary label="Engine" value="Qwen3 Coder" />
              <Summary label="Mechanic" value={game?.mechanic ?? "—"} />
              <Summary label="Inscribe at" value={`${MAX_GAME_BYTES} byte cap`} />
              <Summary label="ROM size" value={game ? `${game.compressedBytes} bytes` : "—"} />
              <Summary label="Ticker" value={symbol ? `$${symbol}` : "—"} />
              <Summary label="Supply" value="1B on Pump.fun curve" />
              <Summary
                label="Dev buy"
                value={
                  solBuy > 0 ? `${solBuy.toFixed(3)} SOL · ${pct.toFixed(2)}%` : "None"
                }
              />
              <Summary label="Mayhem" value={mayhemMode ? "On" : "Off"} />
              <Summary label="Launch cost" value="network rent + Pump.fun" />
            </dl>

            <div className="mt-5 space-y-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="flex gap-2">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                Game bytes live in Solana transaction data so anyone can replay the ROM from the chain.
              </p>
              <p className="flex gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                The token is a real Pump.fun coin. Metadata points back to the inscription signatures.
              </p>
              <p className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Dev buy SOL and % stay in sync via the Pump.fun bonding curve, not a linear guess.
              </p>
            </div>

            <div className="mt-5">
              {wallet.publicKey ? (
                <button
                  type="button"
                  onClick={() => void launch()}
                  disabled={!showLaunch || overLimit || busy !== null || !name || !symbol}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-primary font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy === "launch" ? "Launching…" : "Launch game + token"}
                </button>
              ) : (
                <WalletButton fullWidth connectLabel="Select wallet to launch" />
              )}
            </div>

            {status && !generating ? <p className="mt-3 text-xs text-positive">{status}</p> : null}
            {error ? <p className="mt-3 text-xs text-negative">{error}</p> : null}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const PROMPTS = [
  {
    label: "Orbit Cat",
    prompt: "A one-button dodge game where a cat weaves through falling moons",
  },
  {
    label: "Neon Snake",
    prompt: "Neon snake in a shrinking box — eat bits, don't hit the tail",
  },
  {
    label: "Asteroids",
    prompt: "Tiny spaceship blasting incoming asteroids, one-tap fire",
  },
  {
    label: "Toxic Frog",
    prompt: "Frog hopping logs across a toxic canal, miss and splash",
  },
  {
    label: "Pipe Bird",
    prompt: "Flappy bird through neon pipes, tap to flap, don't clip the gap",
  },
  {
    label: "Memory Pulse",
    prompt: "Simon-style memory game: repeat the glowing pad sequence",
  },
  {
    label: "DOOM",
    prompt: "Doom — first person corridors, shotgun, demons",
  },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1",
        active ? "bg-secondary text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

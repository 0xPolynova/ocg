"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, Lock, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { RomCabinet } from "@/components/rom-cabinet";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WalletButton } from "@/components/wallet-ui";
import { apiUrl } from "@/lib/api";
import { utf8Bytes } from "@/lib/game-codec";
import { upsertLaunch, fetchLaunch } from "@/lib/launches-store";
import {
  formatTokenAmount,
  PUMP_MAX_CURVE_PCT,
  PUMP_MAX_SOL_BUY,
  solForSupplyPct,
  supplyPctForSol,
} from "@/lib/pump-curve";
import { createPumpToken, uploadPumpMetadata } from "@/lib/pump-launch";
import { allocatePlaySlug, publicPlayUrl, tickerSlug } from "@/lib/site";
import { dataUrlToPngFile } from "@/lib/token-art";
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageCustom = useRef(false);
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [mayhemMode, setMayhemMode] = useState(false);
  const [buyMode, setBuyMode] = useState<"pct" | "sol">("sol");
  const [solBuy, setSolBuy] = useState(0);

  const generating = busy === "generate";
  const showLaunch = Boolean(game) && !generating;
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
      setWebsite("");
      setImage(null);
      setImagePreview(null);
      imageCustom.current = false;
      setStatus(json.fallback ? json.error ?? "Used a compact fallback ROM." : "Game ready. Play it, then launch.");
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

  function onShot(dataUrl: string) {
    if (imageCustom.current) return;
    setImagePreview(dataUrl);
    setImage(dataUrlToPngFile(dataUrl, `${(symbol || "ocg").toLowerCase()}.png`));
  }

  async function launch() {
    if (!game) return;
    if (!wallet.publicKey) {
      setError("Connect a wallet to launch on Pump.fun.");
      return;
    }
    if (!image) {
      setError("Wait a moment for the cabinet screenshot, or upload a token image.");
      return;
    }

    setBusy("launch");
    setError(null);
    try {
      const mintKeypair = Keypair.generate();
      const mint = mintKeypair.publicKey.toBase58();
      const slug = await allocatePlaySlug(symbol, mint, fetchLaunch);
      const gameUrl = publicPlayUrl(slug);

      setStatus("Uploading token metadata…");
      const uri = await uploadPumpMetadata({
        name,
        symbol,
        description: [
          description || `OCG · ${prompt.slice(0, 160)}`,
          website.trim() ? `Project: ${website.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" — "),
        image,
        website: gameUrl,
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
        mintKeypair,
      });

      setStatus("Saving game…");
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
        mint,
        creator: wallet.publicKey.toBase58(),
        slug,
        playUrl: gameUrl,
        storeSignatures: [],
        createSignature: created.signature,
        createdAt: Date.now(),
        sparkline: [1, 2, 2, 3, 4, 4, 6, 7, 8, 9, 11, 13],
        marketCapUsd: solBuy * 150,
        volumeUsd: solBuy * 80,
        change24h: 0,
      };
      await upsertLaunch(record);
      setStatus("Launched. Play URL is in the token metadata.");
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
            Prompt a playable arcade. It fills the cabinet, then you launch the Pump.fun coin with
            the play URL in the token metadata.
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

            <RomCabinet game={game} generating={generating} title={name || "Preview"} onShot={onShot} />

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
                      <div className="flex items-center gap-3">
                        {imagePreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imagePreview}
                            alt="Token"
                            className="size-16 rounded-xl border border-border object-cover"
                          />
                        ) : (
                          <div className="size-16 rounded-xl border border-dashed border-border bg-background" />
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            imageCustom.current = Boolean(file);
                            setImage(file);
                            setImagePreview(file ? URL.createObjectURL(file) : null);
                          }}
                          className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
                        />
                      </div>
                    </Field>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Auto-grabbed from the cabinet. Replace it if you want. Immutable after create.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Field label="Project website">
                      <input
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                        placeholder="optional"
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
                    Socials can only be set at creation. Pump.fun website is set to the OCG play page.
                  </p>

                  <button
                    type="button"
                    onClick={() => setMayhemMode((value) => !value)}
                    className="mt-5 flex w-full items-start gap-3 rounded-xl border border-border bg-background/60 px-3 py-3 text-left"
                    aria-pressed={mayhemMode}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
                        mayhemMode
                          ? "border-cyan bg-cyan text-[#041014]"
                          : "border-border bg-background",
                      )}
                      aria-hidden
                    >
                      {mayhemMode ? <Check className="size-3.5 stroke-[3]" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">Mayhem mode</span>
                      <span className="text-xs text-muted-foreground">
                        24h AI trading agent, only set at create. Can increase supply. Same starting
                        market cap.
                      </span>
                    </span>
                  </button>

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
              <Summary
                label="Hosted at"
                value={symbol ? `launchocg.com/${tickerSlug(symbol)}` : "launchocg.com/TICKER"}
              />
              <Summary label="Game size" value={game ? `${game.bytes} bytes` : "—"} />
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
                Game bytes live on OCG. Pump.fun metadata website is the play URL — Solscan cannot run HTML from a transaction.
              </p>
              <p className="flex gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                The token is a real Pump.fun coin. Anyone with the mint can open the game from the metadata link.
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
                  disabled={!showLaunch || busy !== null || !name || !symbol}
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

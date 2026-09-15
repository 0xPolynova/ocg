"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Info, Lock, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { GameFrame } from "@/components/game-frame";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { apiUrl } from "@/lib/api";
import { inscribeGame } from "@/lib/chain-store";
import { MAX_GAME_BYTES } from "@/lib/constants";
import { utf8Bytes } from "@/lib/game-codec";
import { upsertLaunch } from "@/lib/launches-store";
import { createPumpToken, uploadPumpMetadata } from "@/lib/pump-launch";
import type { GenerateGameResponse, OcgLaunch } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CreateStudio() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();

  const [prompt, setPrompt] = useState("A one-button dodge game where a cat weaves through falling moons");
  const [busy, setBusy] = useState<"generate" | "launch" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GenerateGameResponse | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [buyMode, setBuyMode] = useState<"pct" | "sol">("sol");
  const [devBuy, setDevBuy] = useState(0);

  const compressed = game?.compressedBytes ?? 0;
  const overLimit = compressed > MAX_GAME_BYTES;
  const meter = Math.min(100, Math.round((compressed / MAX_GAME_BYTES) * 100));

  const solBuy = useMemo(() => {
    if (buyMode === "sol") return devBuy;
    return Number((devBuy * 0.02).toFixed(3));
  }, [buyMode, devBuy]);

  async function generate() {
    setBusy("generate");
    setError(null);
        setStatus("Designing the arcade ROM…");
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
      setStatus(json.fallback ? json.error ?? "Used a compact fallback ROM." : "Game compiled. Play it, then launch.");
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
        description: `OCG · ${prompt.slice(0, 160)}`,
        image,
        website: typeof window !== "undefined" ? window.location.origin : "",
      });

      setStatus("Creating Pump.fun token…");
      const created = await createPumpToken({
        connection,
        wallet,
        name,
        symbol,
        uri,
        solBuy,
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
        description: prompt,
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
      upsertLaunch(record);
      setStatus("Launched. Your game is live on Launches.");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed.");
      setStatus(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 md:px-6">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight">Create a game</h1>
          <p className="mt-2 text-muted-foreground">
            Prompt a real micro-arcade: title screen, sprites that match the idea, juice, then a Pump.fun
            token. ROMs stay under {MAX_GAME_BYTES.toLocaleString()} gzipped bytes so they fit on Solana.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
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
              {busy === "generate" ? "Building ROM…" : "Generate game"}
            </button>

            {game ? (
              <div className="mt-6 space-y-5">
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="aspect-[16/10] bg-black">
                    <GameFrame html={game.html} title={name || "Preview"} />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      {game.bytes} raw · {game.compressedBytes} gzipped · {game.model}
                    </span>
                    <span className={overLimit ? "text-negative" : "text-positive"}>
                      {meter}% of {MAX_GAME_BYTES} byte cap
                    </span>
                  </div>
                  <div className="h-1 bg-muted">
                    <div
                      className={cn("h-full", overLimit ? "bg-negative" : "bg-positive")}
                      style={{ width: `${meter}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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

                <Field label="Token image">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                    className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
                  />
                </Field>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Dev buy</p>
                    <div className="flex rounded-full border border-border p-0.5 text-xs">
                      <Toggle active={buyMode === "pct"} onClick={() => setBuyMode("pct")}>
                        % of supply
                      </Toggle>
                      <Toggle active={buyMode === "sol"} onClick={() => setBuyMode("sol")}>
                        SOL amount
                      </Toggle>
                    </div>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Optional first buy, bundled with the Pump.fun create so nobody snipes the ROM.
                  </p>
                  <input
                    className="ocg-slider"
                    type="range"
                    min={0}
                    max={buyMode === "sol" ? 2 : 75}
                    step={buyMode === "sol" ? 0.01 : 1}
                    value={devBuy}
                    onChange={(event) => setDevBuy(Number(event.target.value))}
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span>
                      {buyMode === "sol" ? `${solBuy.toFixed(2)} SOL` : `${devBuy}% ≈ ${solBuy.toFixed(3)} SOL`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Generate a ROM first. One mechanic, a character you can recognize, instant restart.
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium">Launch summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Summary label="Engine" value="Gemini Flash · arcade kit" />
              <Summary label="Inscribe at" value={`${MAX_GAME_BYTES} byte cap`} />
              <Summary label="ROM size" value={game ? `${game.compressedBytes} bytes` : "—"} />
              <Summary label="Ticker" value={symbol ? `$${symbol}` : "—"} />
              <Summary label="Supply" value="Pump.fun curve" />
              <Summary label="Dev buy" value={solBuy > 0 ? `${solBuy.toFixed(3)} SOL` : "None"} />
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
                Solana v1 transactions allow up to 4,096 bytes. We keep the gzipped game at 3,000 so the
                instruction still fits.
              </p>
            </div>

            <div className="mt-5">
              {wallet.publicKey ? (
                <button
                  type="button"
                  onClick={() => void launch()}
                  disabled={!game || overLimit || busy !== null || !name || !symbol}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-primary font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy === "launch" ? "Launching…" : "Launch game + token"}
                </button>
              ) : (
                <div className="flex justify-center [&_.wallet-adapter-button-trigger]:h-11 [&_.wallet-adapter-button-trigger]:w-full [&_.wallet-adapter-button-trigger]:justify-center">
                  <WalletMultiButton />
                </div>
              )}
            </div>

            {status ? <p className="mt-3 text-xs text-positive">{status}</p> : null}
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

"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { Check, ExternalLink, Info, Lock, Plus, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GamePromptChat } from "@/components/game-prompt-chat";
import { RomCabinet } from "@/components/rom-cabinet";
import { SiteHeader } from "@/components/site-header";
import { WalletButton } from "@/components/wallet-ui";
import { apiUrl } from "@/lib/api";
import { STUDIO_MAX_DRAFTS, APP_PITCH, CHAT_COOLDOWN_MS, CHAT_MAX_USER_MESSAGES, PUMP_FUN_COIN_URL, SOLSCAN_TOKEN_URL, SOLSCAN_TX_URL } from "@/lib/constants";
import { utf8Bytes } from "@/lib/game-codec";
import { upsertLaunch, fetchLaunch } from "@/lib/launches-store";
import {
  formatTokenAmount,
  pumpLaunchBudget,
  PUMP_MAX_CURVE_PCT,
  PUMP_MAX_SOL_BUY,
  solForSupplyPct,
  supplyPctForSol,
} from "@/lib/pump-curve";
import { createPumpToken, uploadPumpMetadata, assertWalletCanPayForPump } from "@/lib/pump-launch";
import { allocatePlaySlug, playPath, publicPlayUrl, tickerSlug } from "@/lib/site";
import {
  draftTabLabel,
  emptyDraft,
  isChatCapped,
  isDraftLocked,
  readStudioCache,
  type StudioCache,
  type StudioChatMessage,
  type StudioDraft,
  userPromptCount,
  writeStudioCache,
} from "@/lib/studio-store";
import { dataUrlToPngFile } from "@/lib/token-art";
import type { GenerateGameResponse, OcgLaunch } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CreateStudio() {
  const wallet = useWallet();
  const [cache, setCache] = useState<StudioCache | null>(null);
  const [busyById, setBusyById] = useState<Record<string, "generate" | "launch">>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buyDraft, setBuyDraft] = useState<string | null>(null);
  const cacheRef = useRef<StudioCache | null>(null);
  const busyRef = useRef<Record<string, "generate" | "launch">>({});

  useEffect(() => {
    const next = readStudioCache();
    setCache(next);
    cacheRef.current = next;
  }, []);

  useEffect(() => {
    if (!cache) return;
    cacheRef.current = cache;
    writeStudioCache(cache);
  }, [cache]);

  useEffect(() => {
    busyRef.current = busyById;
  }, [busyById]);

  const active = cache?.drafts.find((item) => item.id === cache.activeId) ?? cache?.drafts[0] ?? null;
  const locked = active ? isDraftLocked(active) : false;
  const busy = active ? (busyById[active.id] ?? null) : null;
  const generating = busy === "generate";
  const showLaunch = Boolean(active?.game);
  const originalPrompt = active?.messages.find((item) => item.role === "user")?.content ?? "";
  const pct = useMemo(() => supplyPctForSol(active?.solBuy ?? 0), [active?.solBuy]);
  const sliderValue = active?.buyMode === "pct" ? pct : (active?.solBuy ?? 0);
  const sliderMax = active?.buyMode === "sol" ? PUMP_MAX_SOL_BUY : PUMP_MAX_CURVE_PCT;
  const sliderStep = active?.buyMode === "sol" ? 0.01 : 0.1;

  const setActiveId = useCallback((id: string) => {
    setCache((current) => (current ? { ...current, activeId: id } : current));
    setError(null);
    setStatus(null);
    setBuyDraft(null);
  }, []);

  const patchDraft = useCallback((id: string, partial: Partial<StudioDraft>) => {
    setCache((current) => {
      if (!current) return current;
      return {
        ...current,
        drafts: current.drafts.map((item) =>
          item.id === id ? { ...item, ...partial, updatedAt: Date.now() } : item,
        ),
      };
    });
  }, []);

  function addTab() {
    setCache((current) => {
      if (!current || current.drafts.length >= STUDIO_MAX_DRAFTS) return current;
      const draft = emptyDraft();
      return { drafts: [...current.drafts, draft], activeId: draft.id };
    });
    setError(null);
    setStatus(null);
  }

  function closeTab(id: string) {
    setCache((current) => {
      if (!current || current.drafts.length <= 1) return current;
      const index = current.drafts.findIndex((item) => item.id === id);
      const drafts = current.drafts.filter((item) => item.id !== id);
      const fallback = drafts[Math.max(0, index - 1)] ?? drafts[0];
      return {
        drafts,
        activeId: current.activeId === id ? fallback.id : current.activeId,
      };
    });
  }

  async function send(text: string) {
    const snapshot = cacheRef.current;
    const draft = snapshot?.drafts.find((item) => item.id === snapshot.activeId);
    if (!draft || isDraftLocked(draft) || busyRef.current[draft.id]) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    if (userPromptCount(draft) >= CHAT_MAX_USER_MESSAGES) {
      setError(`This game used all ${CHAT_MAX_USER_MESSAGES} prompts. Open a new tab.`);
      return;
    }
    if (draft.lastPromptAt && Date.now() - draft.lastPromptAt < CHAT_COOLDOWN_MS) {
      const wait = Math.ceil((CHAT_COOLDOWN_MS - (Date.now() - draft.lastPromptAt)) / 1000);
      setError(`Wait ${wait}s before sending another prompt.`);
      return;
    }
    const draftId = draft.id;
    const userMessage: StudioChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const history = [...draft.messages, userMessage];
    patchDraft(draftId, { messages: history, composer: "", lastPromptAt: Date.now() });
    busyRef.current = { ...busyRef.current, [draftId]: "generate" };
    setBusyById((current) => ({ ...current, [draftId]: "generate" }));
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(apiUrl("/api/generate-game"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          messages: history.map(({ role, content }) => ({ role, content })),
          html: draft.game?.html,
          name: draft.name,
          symbol: draft.symbol,
          mechanic: draft.game?.mechanic,
        }),
      });
      const json = (await response.json()) as GenerateGameResponse & { error?: string };
      if (!response.ok && !json.html) throw new Error(json.error ?? "Could not generate a game.");
      const reply =
        json.reply?.trim() ||
        (draft.game ? "Updated. Play it above." : "Game ready. Play it, then launch.");
      const latest = cacheRef.current?.drafts.find((item) => item.id === draftId);
      const currentMessages = latest?.messages ?? history;
      const last = currentMessages[currentMessages.length - 1];
      const nextMessages =
        last?.role === "assistant" && last.content === reply
          ? currentMessages
          : [...currentMessages, { id: crypto.randomUUID(), role: "assistant" as const, content: reply }];
      const firstBuild = !draft.game;
      patchDraft(draftId, {
        messages: nextMessages,
        ...(json.html
          ? {
              game: json,
              name: firstBuild ? json.name : latest?.name || json.name,
              symbol: firstBuild ? json.symbol : latest?.symbol || json.symbol,
              description: firstBuild ? trimmed.slice(0, 200) : latest?.description,
              ...(firstBuild ? { website: "", imagePreview: null, imageCustom: false } : {}),
            }
          : {}),
      });
      if (cacheRef.current?.activeId === draftId) {
        setStatus(json.fallback ? json.error ?? "Used a compact fallback ROM." : reply);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed.";
      if (cacheRef.current?.activeId === draftId) {
        setError(
          message === "Failed to fetch"
            ? "Could not reach the game API. Check that ocg-api is live."
            : message,
        );
      }
    } finally {
      setBusyById((current) => {
        const next = { ...current };
        delete next[draftId];
        return next;
      });
    }
  }

  function onShot(dataUrl: string) {
    if (!active || active.imageCustom || isDraftLocked(active)) return;
    patchDraft(active.id, { imagePreview: dataUrl });
  }

  async function launch() {
    if (!active?.game || isDraftLocked(active)) return;
    if (!wallet.publicKey) {
      setError("Connect a wallet to launch on Pump.fun.");
      return;
    }
    if (!active.imagePreview) {
      setError("Wait a moment for the cabinet screenshot, or upload a token image.");
      return;
    }

    const draftId = active.id;
    if (busyRef.current[draftId]) return;
    busyRef.current = { ...busyRef.current, [draftId]: "launch" };
    setBusyById((current) => ({ ...current, [draftId]: "launch" }));
    setError(null);
    try {
      setStatus("Checking wallet…");
      await assertWalletCanPayForPump(wallet.publicKey, active.solBuy);

      const mintKeypair = Keypair.generate();
      const mint = mintKeypair.publicKey.toBase58();
      const slug = await allocatePlaySlug(active.symbol, mint, fetchLaunch);
      const gameUrl = publicPlayUrl(slug);
      const image = dataUrlToPngFile(active.imagePreview, `${active.symbol.toLowerCase() || "ocg"}.png`);

      setStatus("Uploading token metadata…");
      const uri = await uploadPumpMetadata({
        name: active.name,
        symbol: active.symbol,
        description: [
          active.description || `OCG · ${originalPrompt.slice(0, 160)}`,
          active.website.trim() ? `Project: ${active.website.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" — "),
        image,
        website: gameUrl,
        twitter: active.twitter,
        telegram: active.telegram,
      });

      setStatus("Creating Pump.fun token…");
      const created = await createPumpToken({
        wallet,
        name: active.name,
        symbol: active.symbol,
        uri,
        solBuy: active.solBuy,
        mayhemMode: active.mayhemMode,
        mintSecretKey: mintKeypair.secretKey,
      });

      setStatus("Saving game…");
      const liveMint = created.mint.toBase58();
      const record: OcgLaunch = {
        id: liveMint,
        name: active.name,
        symbol: active.symbol,
        description: active.description || originalPrompt,
        prompt: originalPrompt,
        genre: active.game.genre,
        gameHtml: active.game.html,
        gameBytes: utf8Bytes(active.game.html),
        compressedBytes: active.game.compressedBytes,
        mint: liveMint,
        creator: wallet.publicKey.toBase58(),
        slug,
        playUrl: gameUrl,
        storeSignatures: [],
        createSignature: created.signature,
        createdAt: Date.now(),
        image: active.imagePreview,
        sparkline: [],
      };
      await upsertLaunch(record);
      patchDraft(draftId, { mint: liveMint, createSignature: created.signature });
      setStatus("Launched. This tab is locked — open a new tab to make another game.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed.");
      setStatus(null);
    } finally {
      setBusyById((current) => {
        const next = { ...current };
        delete next[draftId];
        return next;
      });
    }
  }

  function applyBuy(value: number, typed?: string) {
    if (!active || locked) return;
    const clamped = Math.min(sliderMax, Math.max(0, value));
    setBuyDraft(typed ?? null);
    patchDraft(active.id, {
      solBuy: active.buyMode === "sol" ? clamped : solForSupplyPct(clamped),
    });
  }

  function onBuySlider(value: number) {
    applyBuy(value);
  }

  function onBuyTyped(raw: string) {
    if (raw.trim() === "") {
      applyBuy(0, raw);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setBuyDraft(raw);
      return;
    }
    applyBuy(parsed, raw);
  }

  function onImageFile(file: File | null) {
    if (!active || locked) return;
    if (!file) {
      patchDraft(active.id, { imagePreview: null, imageCustom: false });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patchDraft(active.id, {
        imagePreview: typeof reader.result === "string" ? reader.result : null,
        imageCustom: true,
      });
    };
    reader.readAsDataURL(file);
  }

  if (!cache || !active) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <SiteHeader />
        <div className="flex-1 bg-background" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <main className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col overflow-y-auto px-4 py-2 md:px-6 lg:overflow-hidden">
        <div className="mb-2 flex min-h-0 shrink-0 items-center gap-3">
          <div className="shrink-0">
            <h1 className="text-base font-semibold tracking-tight">Create</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">{APP_PITCH}</p>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {cache.drafts.map((draft) => {
              const selected = draft.id === active.id;
              const tabLocked = isDraftLocked(draft);
              const tabBusy = busyById[draft.id];
              return (
                <div
                  key={draft.id}
                  className={cn(
                    "flex shrink-0 items-center rounded-lg border",
                    selected
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(draft.id)}
                    className="flex max-w-40 items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
                  >
                    {tabLocked ? <Lock className="size-3 shrink-0" /> : null}
                    <span className="truncate">{draftTabLabel(draft)}</span>
                    {tabBusy ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
                  </button>
                  {cache.drafts.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Close ${draftTabLabel(draft)}`}
                      onClick={() => closeTab(draft.id)}
                      className="pr-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              onClick={addTab}
              disabled={cache.drafts.length >= STUDIO_MAX_DRAFTS}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-40"
              aria-label="New game tab"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(180px,1.08fr)_minmax(210px,0.92fr)] gap-3">
          <RomCabinet
            game={active.game}
            generating={generating}
            title={active.name || "Preview"}
            onShot={onShot}
            locked={locked}
          />

          <div className="grid min-h-0 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <GamePromptChat
              messages={active.messages}
              draft={active.composer}
              onDraftChange={(value) => patchDraft(active.id, { composer: value })}
              onSend={(text) => void send(text)}
              thinking={generating}
              disabled={busy === "launch" || locked || isChatCapped(active)}
              locked={locked}
              lastPromptAt={active.lastPromptAt}
              userPromptCount={userPromptCount(active)}
            />

            <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div className="shrink-0 border-b border-border px-3 py-1.5">
                <h2 className="text-sm font-medium">{locked ? "Live token" : "Launch"}</h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                <dl className="space-y-1.5 text-xs">
                  <Summary label="Mechanic" value={active.game?.mechanic ?? "—"} />
                  <Summary
                    label="Hosted at"
                    value={
                      active.symbol
                        ? `launchocg.com/${tickerSlug(active.symbol)}`
                        : "launchocg.com/TICKER"
                    }
                  />
                  {locked ? null : (
                    <>
                      <Summary label="Ticker" value={active.symbol ? `$${active.symbol}` : "—"} />
                      <Summary
                        label="Dev buy"
                        value={
                          active.solBuy > 0
                            ? `${active.solBuy.toFixed(3)} SOL · ${pct.toFixed(2)}%`
                            : "None"
                        }
                      />
                      <Summary label="Mayhem" value={active.mayhemMode ? "On" : "Off"} />
                    </>
                  )}
                </dl>

                <AnimatePresence mode="wait" initial={false}>
                  {locked ? (
                    <motion.div
                      key="live"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="mt-3 space-y-3 border-t border-border pt-3"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field label="Name">
                          <p className="flex h-8 items-center truncate rounded-lg border border-border bg-background px-2.5 text-sm">
                            {active.name || "—"}
                          </p>
                        </Field>
                        <Field label="Ticker">
                          <p className="flex h-8 items-center truncate rounded-lg border border-border bg-background px-2.5 text-sm">
                            {active.symbol ? `$${active.symbol}` : "—"}
                          </p>
                        </Field>
                      </div>
                      <div className="flex flex-col gap-2">
                        {active.mint ? (
                          <>
                            <LiveLink
                              href={`${PUMP_FUN_COIN_URL}/${active.mint}`}
                              label="Pump.fun"
                              delay={0.05}
                              primary
                            />
                            <LiveLink
                              href={`${SOLSCAN_TOKEN_URL}/${active.mint}`}
                              label="Solscan"
                              delay={0.12}
                            />
                          </>
                        ) : null}
                        {active.createSignature ? (
                          <LiveLink
                            href={`${SOLSCAN_TX_URL}/${active.createSignature}`}
                            label="Game tx"
                            delay={0.18}
                          />
                        ) : null}
                      </div>
                    </motion.div>
                  ) : showLaunch ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="mt-3 space-y-2.5 border-t border-border pt-3"
                    >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Name">
                        <input
                          value={active.name}
                          maxLength={32}
                          disabled={locked}
                          onChange={(event) => patchDraft(active.id, { name: event.target.value })}
                          className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
                        />
                      </Field>
                      <Field label="Ticker">
                        <input
                          value={active.symbol}
                          maxLength={10}
                          disabled={locked}
                          onChange={(event) =>
                            patchDraft(active.id, { symbol: event.target.value.toUpperCase() })
                          }
                          className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
                        />
                      </Field>
                    </div>

                    <Field label="Description">
                      <textarea
                        value={active.description}
                        maxLength={200}
                        rows={2}
                        disabled={locked}
                        onChange={(event) => patchDraft(active.id, { description: event.target.value })}
                        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
                      />
                    </Field>

                    <Field label="Token image">
                      <div className="flex items-center gap-2">
                        {active.imagePreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={active.imagePreview}
                            alt="Token"
                            className="size-10 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <div className="size-10 rounded-lg border border-dashed border-border bg-background" />
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          disabled={locked}
                          onChange={(event) => onImageFile(event.target.files?.[0] ?? null)}
                          className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-foreground disabled:opacity-50"
                        />
                      </div>
                    </Field>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <Field label="Site">
                        <input
                          value={active.website}
                          disabled={locked}
                          onChange={(event) => patchDraft(active.id, { website: event.target.value })}
                          placeholder="optional"
                          className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
                        />
                      </Field>
                      <Field label="X">
                        <input
                          value={active.twitter}
                          disabled={locked}
                          onChange={(event) => patchDraft(active.id, { twitter: event.target.value })}
                          placeholder="x.com/…"
                          className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
                        />
                      </Field>
                      <Field label="Telegram">
                        <input
                          value={active.telegram}
                          disabled={locked}
                          onChange={(event) => patchDraft(active.id, { telegram: event.target.value })}
                          placeholder="t.me/…"
                          className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
                        />
                      </Field>
                    </div>

                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => patchDraft(active.id, { mayhemMode: !active.mayhemMode })}
                      className="flex w-full flex-nowrap items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-2 text-left disabled:opacity-60"
                      aria-pressed={active.mayhemMode}
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded border",
                          active.mayhemMode
                            ? "border-cyan bg-cyan text-[#041014]"
                            : "border-border bg-background",
                        )}
                        aria-hidden
                      >
                        {active.mayhemMode ? <Check className="size-3 stroke-[3]" /> : null}
                      </span>
                      <span className="shrink-0 text-xs font-medium">Mayhem mode</span>
                      <span className="truncate text-[11px] text-muted-foreground">Only set at create.</span>
                    </button>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-medium">Dev buy</p>
                        <div className="flex rounded-full border border-border p-0.5 text-[11px]">
                          <Toggle
                            active={active.buyMode === "sol"}
                            disabled={locked}
                            onClick={() => {
                              setBuyDraft(null);
                              patchDraft(active.id, { buyMode: "sol" });
                            }}
                          >
                            SOL
                          </Toggle>
                          <Toggle
                            active={active.buyMode === "pct"}
                            disabled={locked}
                            onClick={() => {
                              setBuyDraft(null);
                              patchDraft(active.id, { buyMode: "pct" });
                            }}
                          >
                            %
                          </Toggle>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="ocg-slider min-w-0 flex-1"
                          type="range"
                          min={0}
                          max={sliderMax}
                          step={sliderStep}
                          value={sliderValue}
                          disabled={locked}
                          onChange={(event) => onBuySlider(Number(event.target.value))}
                        />
                        <div className="relative w-[5.5rem] shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={locked}
                            value={
                              buyDraft ??
                              (active.buyMode === "sol" ? active.solBuy.toFixed(3) : pct.toFixed(2))
                            }
                            onChange={(event) => onBuyTyped(event.target.value)}
                            onBlur={() => setBuyDraft(null)}
                            className="h-8 w-full rounded-lg border border-border bg-background px-2 pr-7 text-right text-xs outline-none focus:border-primary/50 disabled:opacity-60"
                            aria-label={active.buyMode === "sol" ? "Dev buy in SOL" : "Dev buy percent of supply"}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-[10px] text-muted-foreground">
                            {active.buyMode === "sol" ? "SOL" : "%"}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {active.solBuy.toFixed(3)} SOL · {pct.toFixed(2)}% of 1B
                        {active.solBuy > 0 ? ` · ~${formatTokenAmount(active.solBuy)} tokens` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {active.solBuy > 0
                          ? `First buy needs about ${pumpLaunchBudget(active.solBuy).totalSol.toFixed(3)} SOL in the wallet (${active.solBuy.toFixed(3)} buy + ${pumpLaunchBudget(active.solBuy).overheadSol.toFixed(3)} create rent). Create with 0 buy is ~0.04 SOL.`
                          : "Create with no buy needs about 0.04 SOL for rent and fees."}
                      </p>
                    </div>
                    </motion.div>
                  ) : (
                    <motion.p
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-3 text-xs text-muted-foreground"
                    >
                      Build a game first. Name, ticker, and image lock in at mint.
                    </motion.p>
                  )}
                </AnimatePresence>

                {locked ? null : (
                <div className="mt-3 space-y-1.5 rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
                  <p className="flex gap-1.5">
                    <Lock className="mt-0.5 size-3 shrink-0" />
                    After launch this tab cannot be edited.
                  </p>
                  <p className="flex gap-1.5">
                    <Sparkles className="mt-0.5 size-3 shrink-0" />
                    Pump.fun website is the OCG play URL.
                  </p>
                  <p className="flex gap-1.5">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    Tabs cache locally so you can switch drafts.
                  </p>
                </div>
                )}
              </div>

              <div className="shrink-0 border-t border-border p-2.5">
                {locked ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={playPath(tickerSlug(active.symbol))}
                      className="flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                    >
                      Play page
                    </Link>
                    <Link
                      href="/"
                      className="flex h-10 items-center justify-center rounded-xl bg-secondary text-sm font-medium text-foreground"
                    >
                      View launches
                    </Link>
                  </div>
                ) : wallet.publicKey ? (
                  <button
                    type="button"
                    onClick={() => void launch()}
                    disabled={!showLaunch || busy !== null || !active.name || !active.symbol}
                    className="flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {busy === "launch" ? "Launching…" : "Launch game + token"}
                  </button>
                ) : (
                  <WalletButton fullWidth connectLabel="Select wallet to launch" />
                )}
                {status && !generating ? <p className="mt-2 text-xs text-positive">{status}</p> : null}
                {error ? <p className="mt-2 text-xs text-negative">{error}</p> : null}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function LiveLink({
  href,
  label,
  delay = 0,
  primary = false,
}: {
  href: string;
  label: string;
  delay?: number;
  primary?: boolean;
}) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium",
        primary
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted",
      )}
    >
      {label}
      <ExternalLink className="size-3.5" />
    </motion.a>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-2 py-0.5 disabled:opacity-50",
        active ? "bg-secondary text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

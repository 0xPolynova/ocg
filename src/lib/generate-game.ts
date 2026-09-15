import {
  MAX_GAME_BYTES,
  OPENROUTER_CODE_MODEL_DEFAULT,
  OPENROUTER_FALLBACK_MODEL,
  OPENROUTER_MODEL_DEFAULT,
  TARGET_RAW_BYTES,
} from "./constants";
import { compressGame, utf8Bytes } from "./game-codec";
import {
  famousGame,
  followsTheme,
  genreFromMechanic,
  hasMechanicSignals,
  isGenericDodgeReskin,
  isThinRom,
  normalizeIdea,
  parsePlan,
  pickMechanic,
  tickerFromPlan,
  type GamePlan,
} from "./game-plan";
import {
  implementSystemPrompt,
  implementUserPrompt,
  planSystemPrompt,
  polishPrompt,
  shrinkPrompt,
  wrongGamePrompt,
} from "./game-prompt";
import { extractHtml } from "./minify-game";
import { fallbackGame } from "./seed-games";
import type { GenerateGameResponse } from "./types";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const CODE_TOKENS = 8192;

async function chat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://launchocg.com",
      "X-Title": "OCG OnChainGame",
    },
    body: JSON.stringify({
      model,
      temperature: opts?.temperature ?? 0.5,
      max_tokens: opts?.maxTokens ?? CODE_TOKENS,
      messages,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 280)}`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty reply.");
  return content;
}

async function withModelFallback(
  apiKey: string,
  primary: string,
  fallback: string,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ text: string; model: string }> {
  try {
    const text = await chat(apiKey, primary, messages, opts);
    return { text, model: primary };
  } catch (error) {
    if (primary === fallback) throw error;
    const text = await chat(apiKey, fallback, messages, opts);
    return { text, model: fallback };
  }
}

function pack(
  html: string,
  plan: GamePlan,
  model: string,
  fallback = false,
  error?: string,
): GenerateGameResponse {
  const ticker = tickerFromPlan(plan);
  return {
    html,
    name: ticker.name,
    symbol: ticker.symbol,
    genre: genreFromMechanic(plan.mechanic),
    mechanic: plan.mechanic,
    bytes: utf8Bytes(html),
    compressedBytes: compressGame(html).byteLength,
    model: fallback ? "ocg-fallback" : model,
    fallback,
    error,
  };
}

function badFit(html: string, plan: GamePlan, idea: string): boolean {
  return (
    isGenericDodgeReskin(html, plan.mechanic) ||
    !hasMechanicSignals(html, plan.mechanic) ||
    !followsTheme(html, plan, idea)
  );
}

export async function generateGameFromPrompt(prompt: string): Promise<{
  status: number;
  body: GenerateGameResponse | { error: string };
}> {
  const trimmed = prompt.trim();
  if (trimmed.length < 3) {
    return { status: 400, body: { error: "Describe the game in a bit more detail." } };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const planModel = process.env.OPENROUTER_MODEL ?? OPENROUTER_MODEL_DEFAULT;
  const codeModel = process.env.OPENROUTER_CODE_MODEL ?? OPENROUTER_CODE_MODEL_DEFAULT;
  const idea = normalizeIdea(trimmed);
  const hinted = pickMechanic(idea);
  const localPlan: GamePlan = parsePlan("{}", idea);
  localPlan.mechanic = hinted;

  if (!apiKey) {
    const demo = fallbackGame(trimmed);
    const result = pack(demo.html, { ...localPlan, title: demo.name.toUpperCase() }, "ocg-fallback", true);
    result.name = demo.name;
    result.symbol = demo.symbol;
    result.error = "Missing OPENROUTER_API_KEY — used a local arcade fallback.";
    return { status: 200, body: result };
  }

  try {
    const known = famousGame(idea);
    let plan: GamePlan;
    if (known) {
      plan = parsePlan("{}", idea);
    } else {
      const planned = await withModelFallback(
        apiKey,
        planModel,
        OPENROUTER_FALLBACK_MODEL,
        [
          { role: "system", content: planSystemPrompt() },
          {
            role: "user",
            content: `The player typed: "${trimmed}"\nNormalized idea: "${idea}"\nIf a mechanic is obvious use ${hinted}. Do not replace their idea with snake or dodge.`,
          },
        ],
        { temperature: 0.25, maxTokens: 700 },
      );
      plan = parsePlan(planned.text, idea);
    }
    if (hinted !== "custom") plan.mechanic = hinted;

    const writeRom = async (messages: ChatMessage[], temperature: number) => {
      const made = await withModelFallback(apiKey, codeModel, OPENROUTER_FALLBACK_MODEL, messages, {
        temperature,
        maxTokens: CODE_TOKENS,
      });
      return { html: extractHtml(made.text), model: made.model };
    };

    let made = await writeRom(
      [
        { role: "system", content: implementSystemPrompt(plan, idea) },
        { role: "user", content: implementUserPrompt(plan, idea) },
      ],
      0.5,
    );
    let html = made.html;
    let usedModel = made.model;

    if (badFit(html, plan, idea)) {
      made = await writeRom(
        [
          { role: "system", content: implementSystemPrompt(plan, idea) },
          { role: "assistant", content: html },
          { role: "user", content: wrongGamePrompt(plan, idea) },
        ],
        0.2,
      );
      html = made.html;
      usedModel = made.model;
    }

    if (isThinRom(html) && /requestAnimationFrame/.test(html)) {
      made = await writeRom(
        [
          { role: "system", content: implementSystemPrompt(plan, idea) },
          { role: "assistant", content: html },
          { role: "user", content: polishPrompt(plan, idea) },
        ],
        0.35,
      );
      html = made.html;
      usedModel = made.model;
    }

    let compressed = compressGame(html).byteLength;
    if (utf8Bytes(html) > TARGET_RAW_BYTES * 1.15 || compressed > MAX_GAME_BYTES) {
      made = await writeRom(
        [
          { role: "system", content: implementSystemPrompt(plan, idea) },
          { role: "assistant", content: html },
          { role: "user", content: shrinkPrompt(plan, idea) },
        ],
        0.15,
      );
      html = made.html;
      usedModel = made.model;
      compressed = compressGame(html).byteLength;
    }

    if (compressed > MAX_GAME_BYTES || !/requestAnimationFrame/.test(html)) {
      const demo = fallbackGame(trimmed);
      const result = pack(
        demo.html,
        { ...plan, title: demo.name.toUpperCase() },
        usedModel,
        true,
        compressed > MAX_GAME_BYTES
          ? `Model game was ${compressed} gzipped bytes (limit ${MAX_GAME_BYTES}). Used a compact ${pickMechanic(trimmed)} fallback.`
          : "Model game had no loop — used a compact fallback.",
      );
      result.name = demo.name;
      result.symbol = demo.symbol;
      return { status: 200, body: result };
    }

    return { status: 200, body: pack(html, plan, usedModel) };
  } catch (error) {
    const demo = fallbackGame(trimmed);
    const result = pack(
      demo.html,
      { ...localPlan, title: demo.name.toUpperCase() },
      "ocg-fallback",
      true,
      error instanceof Error ? error.message : "Game generation failed.",
    );
    result.name = demo.name;
    result.symbol = demo.symbol;
    return { status: 200, body: result };
  }
}

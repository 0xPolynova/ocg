import {
  OPENROUTER_CODE_MODEL_DEFAULT,
  OPENROUTER_FALLBACK_MODELS,
  OPENROUTER_MODEL_DEFAULT,
} from "./constants";
import { compressGame, utf8Bytes } from "./game-codec";
import {
  famousGame,
  genreFromMechanic,
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
  repairPrompt,
  reviseSystemPrompt,
  reviseUserPrompt,
} from "./game-prompt";
import { diagnoseGame } from "./game-qa";
import { extractHtml } from "./minify-game";
import { extractGameScript } from "./wrap-game";
import { fallbackGame } from "./seed-games";
import type { GenerateGameRequest, GenerateGameResponse } from "./types";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const CODE_TOKENS = 16000;

const BANNED_MODELS = [/^qwen\/qwen3-coder/, /^google\/gemini/];

function isBannedModel(value: string): boolean {
  return BANNED_MODELS.some((pattern) => pattern.test(value));
}

function resolveModel(envValue: string | undefined, fallback: string): string {
  const value = envValue?.trim();
  if (!value || isBannedModel(value) || value.startsWith("deepseek/deepseek-v3.2")) return fallback;
  return value;
}

function modelChain(primary: string): string[] {
  const chain = [primary, ...OPENROUTER_FALLBACK_MODELS];
  return [...new Set(chain.filter((id) => id && !isBannedModel(id)))];
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(asText).join("");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
  }
  return "";
}

function choiceText(choice: {
  message?: {
    content?: unknown;
    reasoning?: unknown;
    reasoning_content?: unknown;
  };
}): string {
  const message = choice.message;
  if (!message) return "";
  return (
    asText(message.content).trim() ||
    asText(message.reasoning_content).trim() ||
    asText(message.reasoning).trim()
  );
}

async function chatOne(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ text: string; model: string }> {
  const maxTokens = opts?.maxTokens ?? CODE_TOKENS;
  const fallbacks = modelChain(model).filter((id) => id !== model);
  const thread: ChatMessage[] = [...messages];
  let combined = "";
  let used = model;

  for (let attempt = 0; attempt < 3; attempt += 1) {
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
        models: fallbacks.length ? fallbacks : undefined,
        temperature: opts?.temperature ?? 0.45,
        max_tokens: maxTokens,
        reasoning: { enabled: false, exclude: true },
        messages: thread,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter ${model} ${response.status}: ${text.slice(0, 280)}`);
    }
    const data = (await response.json()) as {
      model?: string;
      choices?: {
        finish_reason?: string;
        message?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown };
      }[];
    };
    const choice = data.choices?.[0];
    const content = choice ? choiceText(choice) : "";
    if (!content) throw new Error(`OpenRouter ${data.model ?? model} returned an empty reply.`);
    used = data.model ?? model;
    combined += content;
    if (choice?.finish_reason !== "length") break;
    thread.push({ role: "assistant", content });
    thread.push({
      role: "user",
      content: "Continue the HTML document exactly where you stopped. No markdown. Do not restart.",
    });
  }

  return { text: combined, model: used };
}

async function chat(
  apiKey: string,
  primary: string,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ text: string; model: string }> {
  const chain = modelChain(primary);
  let lastError: Error | undefined;
  for (const model of chain) {
    try {
      const result = await chatOne(apiKey, model, messages, opts);
      if (result.text.trim()) {
        if (result.model !== primary) {
          console.log(JSON.stringify({ event: "openrouter-fallback", requested: primary, used: result.model }));
        }
        return result;
      }
      lastError = new Error(`${model} returned empty content`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(JSON.stringify({ event: "openrouter-fail", model, error: lastError.message }));
    }
  }
  throw lastError ?? new Error("OpenRouter returned an empty reply.");
}

function pack(
  html: string,
  plan: GamePlan,
  model: string,
  reply: string,
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
    reply,
    fallback,
    error,
  };
}

function keepMechanic(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function lastUserText(messages: { role: string; content: string }[], fallback: string): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item?.role === "user" && item.content.trim()) return item.content.trim();
  }
  return fallback.trim();
}

function chatTranscript(messages: { role: string; content: string }[]): string {
  return messages
    .filter((item) => item.content.trim() && item.role !== "system")
    .slice(-12)
    .map((item) => `${item.role === "user" ? "Player" : "OCG"}: ${item.content.trim()}`)
    .join("\n");
}

function replyFor(revision: boolean, name: string, request: string): string {
  if (!revision) return `Built ${name}. Play it above, or tell me what to change.`;
  const clipped = request.replace(/\s+/g, " ").slice(0, 72);
  return clipped ? `Updated — ${clipped}${request.length > 72 ? "…" : ""}.` : "Updated. Play it above.";
}

export async function generateGameFromPrompt(prompt: string): Promise<{
  status: number;
  body: GenerateGameResponse | { error: string };
}> {
  return generateGameFromChat({ prompt });
}

export async function generateGameFromChat(input: GenerateGameRequest): Promise<{
  status: number;
  body: GenerateGameResponse | { error: string };
}> {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const trimmed = lastUserText(messages, input.prompt ?? "");
  if (trimmed.length < 3) {
    return { status: 400, body: { error: "Describe the game in a bit more detail." } };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const planModel = resolveModel(process.env.OPENROUTER_MODEL, OPENROUTER_MODEL_DEFAULT);
  const codeModel = resolveModel(process.env.OPENROUTER_CODE_MODEL, OPENROUTER_CODE_MODEL_DEFAULT);
  const idea = normalizeIdea(messages.find((item) => item.role === "user")?.content.trim() || trimmed);
  const hinted = pickMechanic(idea);
  const localPlan: GamePlan = parsePlan("{}", idea);
  localPlan.mechanic = keepMechanic(input.mechanic, hinted);
  const revising = Boolean(input.html && /<canvas/i.test(input.html));

  if (!apiKey) {
    const demo = fallbackGame(trimmed);
    const result = pack(
      demo.html,
      { ...localPlan, title: demo.name.toUpperCase() },
      "ocg-fallback",
      replyFor(revising, demo.name, trimmed),
      true,
    );
    result.name = demo.name;
    result.symbol = demo.symbol;
    result.error = "Missing OPENROUTER_API_KEY — used a local playable fallback.";
    return { status: 200, body: result };
  }

  try {
    let plan: GamePlan;
    if (revising) {
      plan = parsePlan("{}", idea);
      plan.mechanic = keepMechanic(input.mechanic, plan.mechanic);
      if (input.name) plan.title = input.name.toUpperCase();
    } else {
      const planned = await chat(
        apiKey,
        planModel,
        [
          { role: "system", content: planSystemPrompt() },
          {
            role: "user",
            content: `The player typed: "${trimmed}"\nNormalized idea: "${idea}"\nDescribe THIS game's real rules. Do not replace their idea with snake, dodge, or a stock arcade template.`,
          },
        ],
        { temperature: 0.2, maxTokens: 700 },
      );
      plan = parsePlan(planned.text, idea);
      if (famousGame(idea) && (!plan.loop || plan.mechanic === "custom")) {
        const known = famousGame(idea);
        if (known) {
          plan.mechanic = keepMechanic(plan.mechanic === "custom" ? known.mechanic : plan.mechanic, known.mechanic);
          if (!plan.loop || plan.loop.startsWith("Play ")) plan.loop = known.brief;
        }
      }
    }

    let made = revising
      ? await chat(
          apiKey,
          codeModel,
          [
            { role: "system", content: reviseSystemPrompt(plan, idea) },
            {
              role: "user",
              content: `Chat so far:\n${chatTranscript(messages)}\n\n${reviseUserPrompt(trimmed, input.html ?? "")}`,
            },
          ],
          { temperature: 0.3, maxTokens: CODE_TOKENS },
        )
      : await chat(
          apiKey,
          codeModel,
          [
            { role: "system", content: implementSystemPrompt(plan, idea) },
            { role: "user", content: implementUserPrompt(plan, idea) },
          ],
          { temperature: 0.3, maxTokens: CODE_TOKENS },
        );

    let html = extractHtml(made.text);
    let issues = diagnoseGame(html);
    for (let pass = 0; pass < 2 && issues.length > 0; pass += 1) {
      console.log(JSON.stringify({ event: "repair-game", pass, mechanic: plan.mechanic, issues }));
      const tooSmall = issues.some((item) => item.includes("too small"));
      const repaired = await chat(
        apiKey,
        codeModel,
        [
          { role: "system", content: implementSystemPrompt(plan, idea) },
          {
            role: "user",
            content: `${tooSmall && pass > 0 ? polishPrompt(plan, idea) : repairPrompt(plan, idea, issues)}\n\nBROKEN HTML:\n${html.slice(0, 22000)}`,
          },
        ],
        { temperature: 0.12, maxTokens: CODE_TOKENS },
      );
      const next = extractHtml(repaired.text);
      const nextIssues = diagnoseGame(next);
      if (next.length < 400) continue;
      if (nextIssues.length <= issues.length) {
        html = next;
        made = repaired;
        issues = nextIssues;
      } else {
        break;
      }
    }

    const scriptChars = extractGameScript(html).length;
    const hasLoop = /requestAnimationFrame/.test(html) || /setInterval\s*\(/.test(html);
    console.log(
      JSON.stringify({
        event: revising ? "revise-game" : "generate-game",
        model: made.model,
        mechanic: plan.mechanic,
        bytes: utf8Bytes(html),
        scriptChars,
        issues,
        hasLoop,
        hasCanvas: /<canvas[\s>]/i.test(html),
      }),
    );

    if (!hasLoop || !/<canvas[\s>]/i.test(html)) {
      if (revising && input.html) {
        const result = pack(input.html, plan, made.model, "Could not apply that change — the last playable build is still up.", true);
        if (input.name) result.name = input.name;
        if (input.symbol) result.symbol = input.symbol;
        result.error = "Revision had no game loop.";
        return { status: 200, body: result };
      }
      return {
        status: 500,
        body: { error: "The model did not ship a playable canvas game. Send the prompt again — do not launch this build." },
      };
    }

    const packed = pack(
      html,
      plan,
      made.model,
      issues.length
        ? `Built ${tickerFromPlan(plan).name}. Play it, then tell me what to tighten.`
        : replyFor(revising, tickerFromPlan(plan).name, trimmed),
    );
    if (revising && input.name) packed.name = input.name;
    if (revising && input.symbol) packed.symbol = input.symbol;
    return { status: 200, body: packed };
  } catch (error) {
    if (revising && input.html) {
      const result = pack(
        input.html,
        localPlan,
        "ocg-fallback",
        "That change failed. The last playable build is still up — try again.",
        true,
        error instanceof Error ? error.message : "Game generation failed.",
      );
      if (input.name) result.name = input.name;
      if (input.symbol) result.symbol = input.symbol;
      return { status: 200, body: result };
    }
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : "Game generation failed. Send the prompt again." },
    };
  }
}

import {
  OPENROUTER_CODE_MODEL_DEFAULT,
  OPENROUTER_FALLBACK_MODEL,
  OPENROUTER_MODEL_DEFAULT,
} from "./constants";
import { compressGame, utf8Bytes } from "./game-codec";
import {
  famousGame,
  genreFromMechanic,
  MECHANICS,
  normalizeIdea,
  parsePlan,
  pickMechanic,
  tickerFromPlan,
  type GamePlan,
  type Mechanic,
} from "./game-plan";
import {
  implementSystemPrompt,
  implementUserPrompt,
  planSystemPrompt,
  reviseSystemPrompt,
  reviseUserPrompt,
} from "./game-prompt";
import { extractHtml } from "./minify-game";
import { extractGameScript } from "./wrap-game";
import { fallbackGame } from "./seed-games";
import type { GenerateGameRequest, GenerateGameResponse } from "./types";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const CODE_TOKENS = 12000;

async function chat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const maxTokens = opts?.maxTokens ?? CODE_TOKENS;
  const thread: ChatMessage[] = [...messages];
  let combined = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
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
        temperature: opts?.temperature ?? 0.45,
        max_tokens: maxTokens,
        messages: thread,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 280)}`);
    }
    const data = (await response.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string } }[];
    };
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty reply.");
    combined += content;
    if (choice.finish_reason !== "length") break;
    thread.push({ role: "assistant", content });
    thread.push({
      role: "user",
      content: "Continue the HTML document exactly where you stopped. No markdown. Do not restart.",
    });
  }

  return combined;
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

function asMechanic(value: string | undefined, fallback: Mechanic): Mechanic {
  return value && (MECHANICS as readonly string[]).includes(value) ? (value as Mechanic) : fallback;
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
  const planModel = process.env.OPENROUTER_MODEL ?? OPENROUTER_MODEL_DEFAULT;
  const codeModel = process.env.OPENROUTER_CODE_MODEL ?? OPENROUTER_CODE_MODEL_DEFAULT;
  const idea = normalizeIdea(messages.find((item) => item.role === "user")?.content.trim() || trimmed);
  const hinted = pickMechanic(idea);
  const localPlan: GamePlan = parsePlan("{}", idea);
  localPlan.mechanic = asMechanic(input.mechanic, hinted);
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
    result.error = "Missing OPENROUTER_API_KEY — used a local arcade fallback.";
    return { status: 200, body: result };
  }

  try {
    const known = famousGame(idea);
    let plan: GamePlan;
    if (revising) {
      plan = parsePlan("{}", idea);
      if (input.mechanic) plan.mechanic = asMechanic(input.mechanic, plan.mechanic);
      else if (hinted !== "custom") plan.mechanic = hinted;
      if (input.name) plan.title = input.name.toUpperCase();
    } else if (known || hinted !== "custom") {
      plan = parsePlan("{}", idea);
      if (hinted !== "custom") plan.mechanic = hinted;
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
        { temperature: 0.25, maxTokens: 500 },
      );
      plan = parsePlan(planned.text, idea);
    }

    const made = revising
      ? await withModelFallback(
          apiKey,
          codeModel,
          OPENROUTER_FALLBACK_MODEL,
          [
            { role: "system", content: reviseSystemPrompt(plan, idea) },
            {
              role: "user",
              content: `Chat so far:\n${chatTranscript(messages)}\n\n${reviseUserPrompt(trimmed, input.html ?? "")}`,
            },
          ],
          { temperature: 0.4, maxTokens: CODE_TOKENS },
        )
      : await withModelFallback(
          apiKey,
          codeModel,
          OPENROUTER_FALLBACK_MODEL,
          [
            { role: "system", content: implementSystemPrompt(plan, idea) },
            { role: "user", content: implementUserPrompt(plan, idea) },
          ],
          { temperature: 0.45, maxTokens: CODE_TOKENS },
        );

    const html = extractHtml(made.text);
    const scriptChars = extractGameScript(html).length;
    console.log(
      JSON.stringify({
        event: revising ? "revise-game" : "generate-game",
        model: made.model,
        mechanic: plan.mechanic,
        bytes: utf8Bytes(html),
        scriptChars,
        hasRaf: /requestAnimationFrame/.test(html),
        hasCanvas: /<canvas[\s>]/i.test(html),
      }),
    );

    if (!/requestAnimationFrame/.test(html) || scriptChars < 80) {
      if (revising && input.html) {
        const result = pack(input.html, plan, made.model, "Could not apply that change — the last playable build is still up.", true);
        if (input.name) result.name = input.name;
        if (input.symbol) result.symbol = input.symbol;
        result.error = "Revision had no game loop.";
        return { status: 200, body: result };
      }
      const demo = fallbackGame(trimmed);
      const result = pack(
        demo.html,
        { ...plan, title: demo.name.toUpperCase() },
        made.model,
        replyFor(false, demo.name, trimmed),
        true,
        "Model game had no loop — used a compact fallback.",
      );
      result.name = demo.name;
      result.symbol = demo.symbol;
      return { status: 200, body: result };
    }

    const packed = pack(html, plan, made.model, replyFor(revising, tickerFromPlan(plan).name, trimmed));
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
    const demo = fallbackGame(trimmed);
    const result = pack(
      demo.html,
      { ...localPlan, title: demo.name.toUpperCase() },
      "ocg-fallback",
      replyFor(false, demo.name, trimmed),
      true,
      error instanceof Error ? error.message : "Game generation failed.",
    );
    result.name = demo.name;
    result.symbol = demo.symbol;
    return { status: 200, body: result };
  }
}

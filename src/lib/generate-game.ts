import {
  MAX_GAME_BYTES,
  OPENROUTER_CODE_MODEL_DEFAULT,
  OPENROUTER_MODEL_DEFAULT,
  TARGET_RAW_BYTES,
} from "./constants";
import { compressGame, utf8Bytes } from "./game-codec";
import {
  followsTheme,
  genreFromMechanic,
  hasMechanicSignals,
  isGenericDodgeReskin,
  MECHANIC_RECIPES,
  parsePlan,
  pickMechanic,
  tickerFromPlan,
  type GamePlan,
} from "./game-plan";
import { extractHtml } from "./minify-game";
import { fallbackGame } from "./seed-games";
import type { GenerateGameResponse } from "./types";

const PLAN_PROMPT = `You are a game director. Turn a one-line idea into a unique micro-arcade design.
Return ONLY JSON:
{"title":"SHOUTY TITLE","mechanic":"snake|flappy|shooter|platformer|frogger|pong|breakout|dodge|collector|maze|rhythm|aim|stacker|runner|memory|custom","controls":"how you play","player":"what the player looks like","hazards":"what hurts/blocks","goal":"how score increases","fail":"how you die","unique":"one twist that is not mouse-dodge falling blobs","mustDraw":["visual A","visual B"],"hint":"one-line control hint"}
Rules:
- mechanic MUST match the user's verbs. snake→snake, shoot→shooter, hop/frog/logs→frogger, flap→flappy, stack→stacker, maze→maze.
- NEVER pick dodge unless the user asked to dodge/avoid/weave.
- title and mustDraw must use nouns from the prompt (cat, moon, frog, asteroid…).
- unique must change the FEEL, not just the sprite colors.`;

function implementPrompt(plan: GamePlan, idea: string): string {
  return `You are a senior Flash arcade coder. Write ONE HTML5 canvas game. Output ONLY HTML.

HARD CAP: ${TARGET_RAW_BYTES} characters. No markdown, fences, comments, URLs, images, libraries.

USER IDEA (obey literally): ${idea}

LOCKED DESIGN:
${JSON.stringify(plan)}

MECHANIC RECIPE — implement this loop, not some other genre:
${MECHANIC_RECIPES[plan.mechanic]}

Runtime already injected (CALL, do not redefine): beep(freq,sec) burst(x,y,color,n) shake(px)
Canvas id=c, 2d context is ctx. Player coords px/py if needed. NEVER put the context in x,y,w,h,p,s,t,e,n.

Rules:
1. fillText the exact title "${plan.title}" on the title screen. Hint: ${plan.hint}
2. Draw ${plan.player} and ${plan.hazards} as recognizable geometry (ears, tails, logs, ships, crescents — not identical circles).
3. TITLE → PLAY → GAME OVER with score + best. Juice: beep/burst/shake on start, score, death. Difficulty ramps.
4. Palette: bg #041014, player #8fd4de, good #3ddc8e, bad #f07178, accent #f8d36a, text #e8fbff. HUD 18px monospace.
5. requestAnimationFrame. Pointer + keyboard as specified in controls.
FORBIDDEN: mouse-lerp dodge with falling ents[] unless mechanic is dodge or collector. That reskin is a failed output.
Build ${plan.mechanic} for "${idea}".`;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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
      max_tokens: opts?.maxTokens ?? 4096,
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
  const hinted = pickMechanic(trimmed);
  const localPlan: GamePlan = parsePlan("{}", trimmed);
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
    const planned = await withModelFallback(
      apiKey,
      planModel,
      OPENROUTER_MODEL_DEFAULT,
      [
        { role: "system", content: PLAN_PROMPT },
        {
          role: "user",
          content: `Idea: ${trimmed}\nPreferred mechanic if it fits: ${hinted}. Do not ignore the idea's nouns and verbs.`,
        },
      ],
      { temperature: 0.4, maxTokens: 500 },
    );
    const plan = parsePlan(planned.text, trimmed);
    if (hinted !== "custom" && plan.mechanic === "dodge" && hinted !== "dodge") {
      plan.mechanic = hinted;
    }

    const build = async (strict = false) => {
      const extra = strict
        ? `\nPREVIOUS OUTPUT WAS A GENERIC MOUSE-DODGE RESKIN. Rewrite from scratch as ${plan.mechanic}. Title fillText MUST be "${plan.title}". Draw ${plan.mustDraw.join(", ")}. Follow the recipe.`
        : "";
      const made = await withModelFallback(
        apiKey,
        codeModel,
        planModel,
        [
          { role: "system", content: implementPrompt(plan, trimmed) + extra },
          { role: "user", content: `Code the ${plan.mechanic} game now. Output ONLY HTML.` },
        ],
        { temperature: strict ? 0.25 : 0.7, maxTokens: 4096 },
      );
      return { html: extractHtml(made.text), model: made.model };
    };

    let made = await build(false);
    let html = made.html;
    let usedModel = made.model;

    const badFit =
      isGenericDodgeReskin(html, plan.mechanic) ||
      !hasMechanicSignals(html, plan.mechanic) ||
      !followsTheme(html, plan, trimmed);

    if (badFit) {
      made = await build(true);
      html = made.html;
      usedModel = made.model;
    }

    let compressed = compressGame(html).byteLength;
    if (utf8Bytes(html) > TARGET_RAW_BYTES * 1.15 || compressed > MAX_GAME_BYTES) {
      const shrunk = await withModelFallback(
        apiKey,
        codeModel,
        planModel,
        [
          { role: "system", content: implementPrompt(plan, trimmed) },
          { role: "assistant", content: html },
          {
            role: "user",
            content: `Same ${plan.mechanic} game, 30% fewer characters. Keep title "${plan.title}", sprites, and the mechanic. Under ${TARGET_RAW_BYTES} chars. Output ONLY HTML.`,
          },
        ],
        { temperature: 0.2, maxTokens: 4096 },
      );
      html = extractHtml(shrunk.text);
      usedModel = shrunk.model;
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

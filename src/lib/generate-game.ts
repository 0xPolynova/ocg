import {
  MAX_GAME_BYTES,
  OPENROUTER_CODE_MODEL_DEFAULT,
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
  MECHANIC_RECIPES,
  normalizeIdea,
  parsePlan,
  pickMechanic,
  tickerFromPlan,
  type GamePlan,
} from "./game-plan";
import { extractHtml } from "./minify-game";
import { fallbackGame } from "./seed-games";
import type { GenerateGameResponse } from "./types";

const PLAN_PROMPT = `You are a game director. Turn the player's idea into a micro-arcade that IS that idea.
Return ONLY JSON:
{"title":"SHOUTY TITLE","mechanic":"fps|snake|flappy|shooter|platformer|frogger|pong|breakout|dodge|collector|maze|rhythm|aim|stacker|runner|memory|custom","controls":"how you play","player":"what the player looks like","hazards":"what hurts/blocks","goal":"how score increases","fail":"how you die","unique":"the camera + loop that match the idea","mustDraw":["visual A","visual B"],"hint":"one-line control hint"}
Rules:
- If they named a famous game, clone its CAMERA: Doom/Wolfenstein = fps raycaster. Mario = side platformer. Tetris = stacker. Pac-Man = maze. Flappy = flap. Snake = snake.
- NEVER pick snake, dodge, or pong unless the idea actually is that game.
- title MUST contain the idea's main noun (DOOM if they said doom).`;

function implementPrompt(plan: GamePlan, idea: string): string {
  const known = famousGame(idea);
  return `You are a senior Flash arcade coder. Write ONE HTML5 canvas game. Output ONLY HTML.

HARD CAP: ${TARGET_RAW_BYTES} characters. No markdown, fences, comments, URLs, images, libraries.

THE PLAYER TYPED: "${idea}"
That sentence IS the game. If they said Doom, the camera is first-person corridors with a gun — not snake, not dodge, not pong.
${known ? `FAMOUS-GAME LOCK: ${known.brief}` : ""}

LOCKED DESIGN:
${JSON.stringify(plan)}

MECHANIC RECIPE — this loop only:
${MECHANIC_RECIPES[plan.mechanic]}

Runtime already injected (CALL, do not redefine): beep(freq,sec) burst(x,y,color,n) shake(px)
Canvas id=c, 2d context is ctx. NEVER store the context in x,y,w,h,p,s,t,e,n.

Rules:
1. fillText the exact title "${plan.title}" on the title screen. Hint: ${plan.hint}
2. Draw ${plan.player} and ${plan.hazards} so a stranger would recognize the idea.
3. TITLE → PLAY → GAME OVER with score + best. Juice: beep/burst/shake. Difficulty ramps.
4. Palette: bg #041014, player #8fd4de, good #3ddc8e, bad #f07178, accent #f8d36a, text #e8fbff.
5. requestAnimationFrame. Controls: ${plan.controls}
FORBIDDEN: ignoring the typed idea; swapping in snake/dodge because they are easier.
Build "${idea}" as ${plan.mechanic}.`;
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
        OPENROUTER_MODEL_DEFAULT,
        [
          { role: "system", content: PLAN_PROMPT },
          {
            role: "user",
            content: `The player typed: "${trimmed}"\nNormalized idea: "${idea}"\nIf a mechanic is obvious use ${hinted}. Do not replace their idea with snake or dodge.`,
          },
        ],
        { temperature: 0.3, maxTokens: 500 },
      );
      plan = parsePlan(planned.text, idea);
    }
    if (hinted !== "custom") plan.mechanic = hinted;

    const build = async (strict = false) => {
      const extra = strict
        ? `\nYOU BUILT THE WRONG GAME. The player asked for "${idea}". Rewrite from scratch as ${plan.mechanic}. Title fillText MUST be "${plan.title}". ${known?.brief ?? ""}`
        : "";
      const made = await withModelFallback(
        apiKey,
        codeModel,
        planModel,
        [
          { role: "system", content: implementPrompt(plan, idea) + extra },
          {
            role: "user",
            content: `Code "${idea}" now as ${plan.mechanic}. Output ONLY HTML. If this is not recognizably "${idea}", you failed.`,
          },
        ],
        { temperature: strict ? 0.2 : 0.45, maxTokens: 4096 },
      );
      return { html: extractHtml(made.text), model: made.model };
    };

    let made = await build(false);
    let html = made.html;
    let usedModel = made.model;

    const badFit =
      isGenericDodgeReskin(html, plan.mechanic) ||
      !hasMechanicSignals(html, plan.mechanic) ||
      !followsTheme(html, plan, idea);

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
          { role: "system", content: implementPrompt(plan, idea) },
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

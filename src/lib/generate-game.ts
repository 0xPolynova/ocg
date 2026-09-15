import {
  MAX_GAME_BYTES,
  OPENROUTER_MODEL_DEFAULT,
  TARGET_RAW_BYTES,
} from "./constants";
import { compressGame, utf8Bytes } from "./game-codec";
import { extractHtml, inferGenre, inferTicker } from "./minify-game";
import { fallbackGame } from "./seed-games";
import type { GenerateGameResponse } from "./types";

const SYSTEM_PROMPT = `You write a complete playable HTML5 canvas mini-game as ONE HTML document.
HARD LIMIT: ${TARGET_RAW_BYTES} characters. Exceeding it is a failure.
Rules:
- No markdown, no explanation, no fences
- No external URLs, fonts, images, libraries, or network calls
- Inline CSS and JS only
- One <canvas id=c>, then const ctx=c.getContext('2d')
- NEVER store the context in x, y, w, h, p, s, t, e, or n. Those are numbers/events.
- Player position MUST be px/py (or paddle). Draw ONLY with ctx.beginPath/ctx.arc/ctx.fillRect/ctx.fillText
- Playable immediately with pointer and/or keyboard
- Show a score and restart on click
- Dark teal arcade look (#041014 background, #8fd4de player, #3ddc8e score, #f07178 hazards)
- Short variable names, no comments
Output ONLY the HTML.`;

async function complete(apiKey: string, model: string, prompt: string, extra?: string) {
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
      temperature: 0.7,
      max_tokens: 1800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: extra
            ? `${extra}\n\nGame idea: ${prompt}`
            : `Build this tiny on-chain game: ${prompt}`,
        },
      ],
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
  if (!content) throw new Error("OpenRouter returned an empty game.");
  return extractHtml(content);
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
  const model = process.env.OPENROUTER_MODEL ?? OPENROUTER_MODEL_DEFAULT;
  const inferred = inferTicker(trimmed);
  const genre = inferGenre(trimmed);

  const pack = (html: string, fallback = false): GenerateGameResponse => ({
    html,
    name: inferred.name,
    symbol: inferred.symbol,
    genre,
    bytes: utf8Bytes(html),
    compressedBytes: compressGame(html).byteLength,
    model: fallback ? "ocg-fallback" : model,
    fallback,
  });

  if (!apiKey) {
    const demo = fallbackGame(trimmed);
    const result = pack(demo.html, true);
    result.name = demo.name;
    result.symbol = demo.symbol;
    result.error = "Missing OPENROUTER_API_KEY — used a local arcade fallback.";
    return { status: 200, body: result };
  }

  try {
    let html = await complete(apiKey, model, trimmed);
    let compressed = compressGame(html).byteLength;

    if (utf8Bytes(html) > TARGET_RAW_BYTES || compressed > MAX_GAME_BYTES) {
      html = await complete(
        apiKey,
        model,
        trimmed,
        `Shrink the previous idea to under ${TARGET_RAW_BYTES} characters. Same game, fewer bytes.`,
      );
      compressed = compressGame(html).byteLength;
    }

    if (compressed > MAX_GAME_BYTES) {
      const demo = fallbackGame(trimmed);
      const result = pack(demo.html, true);
      result.error = `Model game was ${compressed} gzipped bytes (limit ${MAX_GAME_BYTES}). Used a compact fallback.`;
      return { status: 200, body: result };
    }

    return { status: 200, body: pack(html) };
  } catch (error) {
    const demo = fallbackGame(trimmed);
    const result = pack(demo.html, true);
    result.error = error instanceof Error ? error.message : "Game generation failed.";
    return { status: 200, body: result };
  }
}

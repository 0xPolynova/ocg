import {
  MAX_GAME_BYTES,
  OPENROUTER_MODEL_DEFAULT,
  TARGET_RAW_BYTES,
} from "./constants";
import { compressGame, utf8Bytes } from "./game-codec";
import { extractHtml, inferGenre, inferTicker } from "./minify-game";
import { fallbackGame } from "./seed-games";
import type { GenerateGameResponse } from "./types";

const SYSTEM_PROMPT = `You are a senior Flash-era arcade designer. Write ONE complete HTML5 canvas game.

HARD CAP: ${TARGET_RAW_BYTES} characters. Output ONLY the HTML. No markdown, fences, comments, or extra text.

Runtime (already injected around your script — CALL these, do not redefine):
- beep(freq, seconds)  square-wave blip
- burst(x,y,color,n)   particle explosion
- shake(pixels)        screen punch
- canvas id=c, 2d context in ctx (and C). Player position MUST be px/py. NEVER store the context in x,y,w,h,p,s,t,e,n.

Must-feel rules:
1. The game is OBVIOUSLY the user's idea. Draw recognizable sprites with arcs/triangles/rects (cat = body+ears+tail+eyes, moon = crescent, ship = triangle, snake = linked circles, coin = disc+inner ring). NEVER make every entity the same circle.
2. States: TITLE (invented game name + one-line control hint) → PLAY → GAME OVER (score + best + click to retry).
3. Juice on every beat: beep on start/score/hit/death, burst on score and death, shake on hit/death.
4. Difficulty ramps (spawn faster / move faster as score grows). Playable 30+ seconds.
5. Pointer + keyboard. Lerp the player toward the pointer (px+=(tx-px)*0.2) — no teleport.
6. HUD: score and best in 18px monospace. Palette bg #041014, player #8fd4de, good #3ddc8e, bad #f07178, accent #f8d36a, text #e8fbff.
7. Starfield or grid in the background. Glow via ctx.shadowBlur on the player only.
8. requestAnimationFrame loop. No libraries, no URLs, no images, no fonts.

Skeleton to fill (change sprites, spawn, and win/lose — keep the engine):
<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;px=W/2;py=H/2;tx=px;ty=py;s=0;best=0;t=0;st=0;g=1;ents=[];
onmousemove=e=>{tx=e.clientX;ty=e.clientY}
ontouchmove=e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;e.preventDefault()}
onkeydown=e=>{if(e.key==='ArrowLeft')tx-=40;if(e.key==='ArrowRight')tx+=40;if(e.key==='ArrowUp')ty-=40;if(e.key==='ArrowDown')ty+=40}
function sprPlayer(x,y){/* THEME */}
function sprEnemy(o){/* THEME */}
function L(){
 t++;px+=(tx-px)*.2;py+=(ty-py)*.2;
 ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#163033';for(i=0;i<50;i++)ctx.fillRect((i*97+t*.3)%W,(i*53)%H,2,2);
 if(!st){sprPlayer(W/2,H/2);ctx.fillStyle='#e8fbff';ctx.font='bold 22px monospace';ctx.fillText('TITLE',24,48);ctx.font='14px monospace';ctx.fillText('click to start',24,72)}
 else if(g){ /* spawn, move, collide, draw, hud; on death: burst(px,py,'#8fd4de',22);shake(12);beep(90,.2);g=0;best=Math.max(best,s) */ }
 else {ctx.fillStyle='#e8fbff';ctx.font='bold 22px monospace';ctx.fillText('GAME OVER  '+s,24,48);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,72)}
 requestAnimationFrame(L)
}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;ents=[];t=0;beep(520,.06)}}
L()
</script>

Make it genuinely fun. One mechanic, executed with craft. Do not ship the skeleton unchanged — TITLE, sprites, and spawn rules must match the idea.`;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function hasCraft(html: string): boolean {
  const loop = /requestAnimationFrame/.test(html);
  const juice = /\bburst\s*\(/.test(html) || /\bbeep\s*\(/.test(html);
  const drawn = /lineTo|quadraticCurveTo|moveTo/.test(html);
  return loop && juice && drawn;
}

async function complete(
  apiKey: string,
  model: string,
  prompt: string,
  extra?: string,
  previous?: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Build this tiny on-chain arcade game: ${prompt}` },
  ];
  if (previous && extra) {
    messages.push({ role: "assistant", content: previous });
    messages.push({ role: "user", content: extra });
  } else if (extra) {
    messages[1] = { role: "user", content: `${extra}\n\nGame idea: ${prompt}` };
  }

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
      temperature: extra ? 0.35 : 0.55,
      max_tokens: 4096,
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

    if (!hasCraft(html) && compressed < MAX_GAME_BYTES * 0.92) {
      html = await complete(
        apiKey,
        model,
        trimmed,
        `This is too generic. Match the idea with recognizable sprites (not identical circles). Add title + game over, lerp the player, call beep/burst/shake on start/score/death, ramp difficulty. Stay under ${TARGET_RAW_BYTES} characters. Output ONLY HTML.`,
        html,
      );
      compressed = compressGame(html).byteLength;
    }

    if (utf8Bytes(html) > TARGET_RAW_BYTES * 1.15 || compressed > MAX_GAME_BYTES) {
      html = await complete(
        apiKey,
        model,
        trimmed,
        `Same game, 30% fewer characters. Keep sprites, title, juice calls, and the loop. Under ${TARGET_RAW_BYTES} characters. Output ONLY HTML.`,
        html,
      );
      compressed = compressGame(html).byteLength;
    }

    if (compressed > MAX_GAME_BYTES || !/requestAnimationFrame/.test(html)) {
      const demo = fallbackGame(trimmed);
      const result = pack(demo.html, true);
      result.name = inferred.name;
      result.symbol = inferred.symbol;
      result.error =
        compressed > MAX_GAME_BYTES
          ? `Model game was ${compressed} gzipped bytes (limit ${MAX_GAME_BYTES}). Used a compact fallback.`
          : "Model game had no loop — used a compact fallback.";
      return { status: 200, body: result };
    }

    return { status: 200, body: pack(html) };
  } catch (error) {
    const demo = fallbackGame(trimmed);
    const result = pack(demo.html, true);
    result.name = inferred.name;
    result.symbol = inferred.symbol;
    result.error = error instanceof Error ? error.message : "Game generation failed.";
    return { status: 200, body: result };
  }
}

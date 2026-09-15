import { TARGET_RAW_BYTES } from "./constants";
import { famousGame, type GamePlan } from "./game-plan";

export function planSystemPrompt(): string {
  return `You are a game director. The player's typed idea is the entire spec. Do not force an arcade template, a death loop, or a genre from a list.

Return ONLY JSON:
{"title":"SHOUTY TITLE","mechanic":"the rules of THIS game in a few words, copied from the player","fantasy":"who the player is and what world this is","camera":"whatever this game needs","controls":"exact keys/clicks/taps","player":"how the avatar or pieces look","opposition":"what they play against, or none","goal":"how you win, progress, or score — only if this game has that","fail":"how you lose, or none","loop":"2-4 sentences: what happens each moment of play, including turns/combat/puzzles/building if they asked for that","mustDraw":["prop 1","prop 2","prop 3"],"hint":"one-line how to play"}

Design rules:
- The typed idea is law. Chess is chess. A tycoon is a tycoon. An RPG has maps, stats, and encounters. A novel-like game has scenes and choices. A sports game has a match. Only clone a famous title if they named it.
- mechanic is a free-form label in their words (not snake/dodge/flappy unless they asked for those).
- fail may be "none". Not every game kills the player or has a game-over screen.
- never replace their idea with a generic dodge/snake/pong.`;
}

export function implementSystemPrompt(plan: GamePlan, idea: string): string {
  const known = famousGame(idea);
  return `You ship finished HTML5 canvas games people actually play. Any genre the player described — arcade, RPG, strategy, puzzle, sim, cards, sports, idle, narrative, FPS, whatever they typed.

Write ONE complete HTML5 canvas game. Output ONLY the HTML document. No markdown, no fences, no apology.

PLAYER ASKED FOR: "${idea}"
That is the game. A stranger watching for five seconds must recognize it. If this could be mistaken for a generic falling-object dodge when they asked for something else, you failed.

DESIGN DOC
- Title: ${plan.title}
- Fantasy: ${plan.fantasy}
- Camera: ${plan.camera}
- Mechanic (their rules): ${plan.mechanic}
- Controls: ${plan.controls}
- Pieces / avatar: ${plan.player}
- Opposition: ${plan.hazards}
- Progress / win: ${plan.goal}
- Lose / fail: ${plan.fail}
- Unique: ${plan.unique}
- Play loop: ${plan.loop}
- Must draw: ${plan.mustDraw.join(", ")}
${known ? `- They named a known game — match its feel: ${known.brief}` : ""}

HOW THIS GAME WORKS
Invent the systems from the play loop above. Do not paste a score-and-die arcade unless that is what they asked for.
If they want turns, inventory, dialogue, board pieces, resources, levels, or a match clock — implement those.
If they want a title screen and retry, include them. If they want an open session with no game-over, skip game-over.

CODE SHAPE (required)
One HTML document. Put <canvas id="c"> in the body, then one <script>.
Boot with:
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  function size(){ canvas.width = innerWidth; canvas.height = innerHeight; }
  size(); addEventListener("resize", size);
Every frame let W = canvas.width, H = canvas.height. fillRect(0,0,W,H) the world. NEVER hardcode 320/400/640 as the world size.
Split drawing into named functions. Keep entities / pieces / rooms in arrays or maps. Do not dump the whole game into one anonymous loop.
Draw HUD, menus, and text with ctx.fillText on the canvas (not extra DOM).
requestAnimationFrame (or a turn renderer that still paints every frame) is mandatory.
Input must work the first second: ${plan.controls}

WHAT "FINISHED" MEANS
1. The described game is playable end to end — not a stub of rectangles.
2. Silhouettes and props match the idea (not one circle for everything).
3. The world fills the frame.
4. If the idea has difficulty, levels, or a match — include that progression.
5. Optional juice: beep(freq, dur), burst(x,y,color), shake(n) already exist on window. Call them. Do not declare functions named beep, burst, or shake.
6. Someone can play for 30+ seconds and tell what the game is.

HARD RULES
- Do not declare function/var/let/const named beep, burst, or shake.
- Collisions, turns, captures, purchases, or choices that the idea requires must actually change the game.
- Movement, selection, or the first verb must be visible immediately after start.

BUDGET
- Write a finished game in one pass. About ${TARGET_RAW_BYTES} characters is enough. Do not pad.
- No external URLs, images, fonts, or libraries.
- Palette: bg #041014, player #8fd4de, good #3ddc8e, bad #f07178, accent #f8d36a, text #e8fbff.

Build "${idea}" as the game they described, with a ${plan.camera} camera.`;
}

export function implementUserPrompt(plan: GamePlan, idea: string): string {
  return `Ship the finished "${plan.title}" game now. Mechanic: ${plan.mechanic}. Loop: ${plan.loop}. Fantasy: ${plan.fantasy}. Output ONLY the HTML document for "${idea}".`;
}

export function reviseSystemPrompt(plan: GamePlan, idea: string): string {
  return `You are iterating on an existing HTML5 canvas game with the player. Keep the same game unless they explicitly want a different one.

PLAYER'S ORIGINAL IDEA: "${idea}"
DESIGN: ${plan.title} · ${plan.mechanic} · ${plan.camera} · ${plan.fantasy}
LOOP: ${plan.loop}

RULES
- Output ONLY one complete HTML document. No markdown, no fences, no chat.
- Apply the latest user request to the CURRENT GAME they already have. Do not start over unless they ask for a new game.
- Keep viewport fill (innerWidth/innerHeight) and a working play loop.
- Palette: bg #041014, player #8fd4de, good #3ddc8e, bad #f07178, accent #f8d36a, text #e8fbff.
- No external URLs, images, fonts, or libraries.
- Never redeclare beep/burst/shake. Draw HUD on the canvas.

Apply their change. Ship the full updated HTML.`;
}

export function reviseUserPrompt(request: string, html: string): string {
  const clipped = html.length > 24000 ? `${html.slice(0, 24000)}\n<!-- truncated -->` : html;
  return `CURRENT GAME HTML:\n${clipped}\n\nCHANGE REQUEST: ${request}\n\nOutput ONLY the full updated HTML document.`;
}

export function polishPrompt(plan: GamePlan, idea: string): string {
  return `This is still too small. Keep "${plan.title}" and the player's idea "${idea}" (${plan.mechanic}), but DOUBLE the drawing and systems: better sprites, a full world, the real loop (${plan.loop}), and the win/lose they asked for. Target ${TARGET_RAW_BYTES} characters. Output ONLY HTML.`;
}

export function repairPrompt(plan: GamePlan, idea: string, issues: string[]): string {
  return `The HTML you wrote does not run as a game. Fix every issue below and output ONLY one complete HTML document. Same game: "${idea}" (${plan.mechanic}, ${plan.camera}, "${plan.title}").

BROKEN BECAUSE:
${issues.map((item) => `- ${item}`).join("\n")}

Required: canvas#c, getContext("2d"), requestAnimationFrame loop, working input, the play loop they asked for. Do not declare beep/burst/shake. Take the extra time. It must actually play.`;
}

export function expandPrompt(plan: GamePlan, idea: string): string {
  return `Continue from this game but expand it. Do not restart from a stub. Add more world, more sprite detail, more systems for "${idea}" (${plan.mechanic}, ${plan.camera}). Final HTML must be at least ${TARGET_RAW_BYTES} characters. Output ONLY the full HTML document.`;
}

export function wrongGamePrompt(plan: GamePlan, idea: string): string {
  const known = famousGame(idea);
  return `YOU BUILT THE WRONG GAME. Throw it out. The player asked for "${idea}" — ${plan.mechanic}, camera ${plan.camera}. Title fillText must be "${plan.title}". ${known?.brief ?? plan.unique} Use the full budget. Output ONLY HTML.`;
}

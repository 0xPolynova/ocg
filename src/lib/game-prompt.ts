import { TARGET_RAW_BYTES } from "./constants";
import { cameraFor, famousGame, MECHANIC_RECIPES, type GamePlan } from "./game-plan";

export function planSystemPrompt(): string {
  return `You are a game director shipping a finished Newgrounds-era micro-game, not a prototype.

Return ONLY JSON:
{"title":"SHOUTY TITLE","mechanic":"fps|snake|flappy|shooter|platformer|frogger|pong|breakout|dodge|collector|maze|rhythm|aim|stacker|runner|memory|custom","fantasy":"who the player is and what world this is","camera":"first-person|side|top-down|rail|…","controls":"exact keys/clicks","player":"how the avatar looks, body parts","hazards":"what kills/blocks, how it looks","goal":"how score increases","fail":"how you die","unique":"the one verb + camera that makes this THAT game","mustDraw":["prop 1","prop 2","prop 3"],"hint":"one-line how to play"}

Design rules:
- The typed idea is law. If they named a famous game, clone its camera and verb (Doom = FPS corridors + shotgun, Mario = side jump, Tetris = tetrominoes, Pac-Man = maze pellets, Snake = growing body).
- Fantasy must be a sentence a player would feel ("you are a marine in a demon base"), not "arcade game".
- mustDraw are concrete shapes (shotgun, horns, pipes, mushroom, log), not "player" or "enemy".
- Never pick snake/dodge/pong unless that is actually the idea.`;
}

export function implementSystemPrompt(plan: GamePlan, idea: string): string {
  const known = famousGame(idea);
  return `You ship finished Flash / Newgrounds micro-games that people actually play for minutes, not 20-line canvas stubs.

Write ONE complete HTML5 canvas game. Output ONLY the HTML document. No markdown, no fences, no apology.

PLAYER ASKED FOR: "${idea}"
That is the game. A stranger watching for five seconds must recognize it. If this could be mistaken for a generic dodge/snake/pong, you failed.

DESIGN DOC
- Title: ${plan.title}
- Fantasy: ${plan.fantasy}
- Camera: ${plan.camera} (${cameraFor(plan.mechanic)})
- Mechanic: ${plan.mechanic}
- Controls: ${plan.controls}
- Avatar: ${plan.player}
- Opposition: ${plan.hazards}
- Score: ${plan.goal}
- Death: ${plan.fail}
- Unique: ${plan.unique}
- Must draw: ${plan.mustDraw.join(", ")}
${known ? `- Famous-game lock: ${known.brief}` : ""}

HOW THIS GENRE WORKS — follow this loop, not a different one
${MECHANIC_RECIPES[plan.mechanic]}

CODE SHAPE (required)
<canvas id=c></canvas> then a script. 2d context lives in ctx. Never store ctx in x,y,w,h,p,s,t,e,n.
VIEWPORT: the cabinet scales this canvas to fill a 16:10 box. Every frame read W=cv.width, H=cv.height (or innerWidth/innerHeight). NEVER hardcode 320/400/640. fillRect(0,0,W,H) the whole world. Positions and collisions must use W/H so the game fills the cabinet.
let mode=0; // 0 title, 1 play, 2 over
let score=0,best=0;
function reset(){ /* rebuild world, score=0, mode=1 */ }
onkeydown / onpointerdown:
  if(mode!==1){ reset(); beep(880,.08); return }
  else apply ${plan.controls}
requestAnimationFrame loop:
  if(mode===0) draw title "${plan.title}" huge + hint "${plan.hint}" + "CLICK / KEY TO START"
  else if(mode===2) draw GAME OVER, score, best, "retry"
  else simulate the ${plan.mechanic} loop, draw the world, HUD (score + best${plan.mechanic === "fps" ? " + HP" : ""})
On death: shake(10); burst(...); beep(120,.2); mode=2; best=Math.max(best,score)

WHAT "FINISHED" MEANS (all required, not optional)
1. Title screen → play → die → retry. A real session, not auto-start chaos.
2. A character with silhouette (ears, gun, wings, legs, hat, mouth) — never the same circle for hero, enemy, and pickup.
3. A world: floor/sky/walls/stars/rooms/lanes. Not a void with dots.
4. Tension + ramp: it gets harder (faster ticks, tighter gaps, more enemies, less ammo).
5. Juice: beep(freq,sec), burst(x,y,color,n), shake(px) on start, score, hit, death. Those functions already exist — call them, do not redefine them.
6. Playable for 30+ seconds for a decent player. Include at least one interesting setpiece (a room, a pipe pair, a ghost, a brick row, a demon).

BUDGET
- Target ${TARGET_RAW_BYTES} characters of HTML. USE the budget. Under 4000 characters is an unfinished ROM — keep drawing.
- No external URLs, images, fonts, or libraries. Inline CSS/JS only.
- Palette: bg #041014, player #8fd4de, good #3ddc8e, bad #f07178, accent #f8d36a, text #e8fbff.

Build "${idea}" as a real ${plan.mechanic} game with a ${plan.camera} camera.`;
}

export function implementUserPrompt(plan: GamePlan, idea: string): string {
  return `Ship the finished "${plan.title}" ROM now. Camera is ${plan.camera}. Mechanic is ${plan.mechanic}. Fantasy: ${plan.fantasy}. Use the full ~${TARGET_RAW_BYTES} character budget. Output ONLY the HTML document for "${idea}".`;
}

export function polishPrompt(plan: GamePlan, idea: string): string {
  return `This ROM is a stub, not a game. Keep ${plan.mechanic} + title "${plan.title}" + camera ${plan.camera}, but FINISH it: better sprites for ${plan.player} and ${plan.hazards}, a world (not empty canvas), title/play/game-over, difficulty ramp, HUD, juice (beep/burst/shake). Aim near ${TARGET_RAW_BYTES} characters. It must still be recognizably "${idea}". Output ONLY HTML.`;
}

export function shrinkPrompt(plan: GamePlan, idea: string): string {
  return `Same "${idea}" ${plan.mechanic} game titled "${plan.title}", ~30% fewer characters. Do not gut the camera, sprites, title screen, or loop. Under ${TARGET_RAW_BYTES} characters. Output ONLY HTML.`;
}

export function wrongGamePrompt(plan: GamePlan, idea: string): string {
  const known = famousGame(idea);
  return `YOU BUILT THE WRONG GAME. Throw it out. The player asked for "${idea}" — mechanic ${plan.mechanic}, camera ${plan.camera}. Title fillText must be "${plan.title}". ${known?.brief ?? plan.unique} Use the full ROM budget. Output ONLY HTML.`;
}

import { TARGET_RAW_BYTES } from "./constants";
import { cameraFor, famousGame, MECHANIC_RECIPES, type GamePlan } from "./game-plan";

export function planSystemPrompt(): string {
  return `You are a game director shipping a finished arcade game, not a prototype.

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
  return `You ship finished HTML5 arcade games people actually play, not 80-line canvas stubs.

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
The host already created <canvas id=c> and set canvas, cv, c, and ctx (2d). Use those names. Do not getElementById('canvas'). Do not assume an element id of canvas.
Never store ctx in x,y,w,h,p,s,t,e,n.
VIEWPORT: on boot and resize set canvas.width=innerWidth; canvas.height=innerHeight. Every frame let W=innerWidth,H=innerHeight. NEVER hardcode 320/400/640. fillRect(0,0,W,H) the whole world.
Split drawing into named functions: drawWorld, drawPlayer, drawHazards, drawHUD, drawTitle, drawOver. Keep entities in arrays. Do not dump the whole game into one anonymous loop.
let mode=0; // 0 title, 1 play, 2 over
let score=0,best=0;
function reset(){ /* rebuild world, score=0, mode=1 */ }
onkeydown / onpointerdown:
  if(mode!==1){ reset(); beep(880,.08); return }
  else apply ${plan.controls}
requestAnimationFrame loop:
  if(mode===0) drawTitle()
  else if(mode===2) drawOver()
  else simulate the ${plan.mechanic} loop, drawWorld/Player/Hazards/HUD
On death: shake(10); burst(...); beep(120,.2); mode=2; best=Math.max(best,score)

WHAT "FINISHED" MEANS (all required)
1. Title screen → play → die → retry.
2. Silhouette sprites (not one circle for everything).
3. A world that fills the frame: floor/sky/walls/rooms/lanes.
4. Difficulty ramp.
5. Juice: beep, burst, shake on start, score, hit, death.
6. Playable for 30+ seconds. At least one setpiece.

BUDGET
- Write at least ${TARGET_RAW_BYTES} characters of HTML/JS. Short output is a failed game. Keep adding sprite functions, rooms, and juice until you hit that size.
- No external URLs, images, fonts, or libraries.
- Palette: bg #041014, player #8fd4de, good #3ddc8e, bad #f07178, accent #f8d36a, text #e8fbff.

Build "${idea}" as a real ${plan.mechanic} game with a ${plan.camera} camera.`;
}

export function implementUserPrompt(plan: GamePlan, idea: string): string {
  return `Ship the finished "${plan.title}" game now. Camera is ${plan.camera}. Mechanic is ${plan.mechanic}. Fantasy: ${plan.fantasy}. You must output at least ${TARGET_RAW_BYTES} characters. Output ONLY the HTML document for "${idea}".`;
}

export function polishPrompt(plan: GamePlan, idea: string): string {
  return `This is still too small. Keep ${plan.mechanic} + title "${plan.title}" + camera ${plan.camera}, but DOUBLE the drawing code: better sprites for ${plan.player} and ${plan.hazards}, a full world, title/play/game-over, ramp, HUD, juice. Target ${TARGET_RAW_BYTES} characters. It must still be recognizably "${idea}". Output ONLY HTML.`;
}

export function expandPrompt(plan: GamePlan, idea: string): string {
  return `Continue from this game but expand it. Do not restart from a stub. Add more world, more sprite detail, more entities, and more juice for "${idea}" (${plan.mechanic}, ${plan.camera}). Final HTML must be at least ${TARGET_RAW_BYTES} characters. Output ONLY the full HTML document.`;
}

export function wrongGamePrompt(plan: GamePlan, idea: string): string {
  const known = famousGame(idea);
  return `YOU BUILT THE WRONG GAME. Throw it out. The player asked for "${idea}" — mechanic ${plan.mechanic}, camera ${plan.camera}. Title fillText must be "${plan.title}". ${known?.brief ?? plan.unique} Use the full budget. Output ONLY HTML.`;
}


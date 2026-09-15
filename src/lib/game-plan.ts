import type { Genre } from "@/lib/constants";

export const MECHANICS = [
  "fps",
  "snake",
  "flappy",
  "shooter",
  "platformer",
  "frogger",
  "pong",
  "breakout",
  "dodge",
  "collector",
  "maze",
  "rhythm",
  "aim",
  "stacker",
  "runner",
  "memory",
  "custom",
] as const;

export type Mechanic = (typeof MECHANICS)[number];

export type GamePlan = {
  title: string;
  mechanic: Mechanic;
  controls: string;
  player: string;
  hazards: string;
  goal: string;
  fail: string;
  unique: string;
  mustDraw: string[];
  hint: string;
};

const HINTS: { mechanic: Mechanic; re: RegExp }[] = [
  { mechanic: "fps", re: /\bdoom\b|wolfenstein|quake|duke nukem|fps|first.?person|raycast|2\.5d|demon|shotgun/ },
  { mechanic: "snake", re: /snake|snek|nibble|slither|tail/ },
  { mechanic: "flappy", re: /flappy|flap|tap.?jump|bird.*pipe|helicopter/ },
  { mechanic: "shooter", re: /shoot|blast|asteroid|space.?ship|bullet|gun|invader|galaga|fire/ },
  { mechanic: "frogger", re: /frog|log|lane|cross(ing)? (the |a )?(road|canal|river|highway)/ },
  { mechanic: "platformer", re: /platform|jump|hop|leap|\bmario\b|\bsonic\b/ },
  { mechanic: "pong", re: /pong|paddle|volley|pinpong/ },
  { mechanic: "breakout", re: /breakout|brick|arcanoid/ },
  { mechanic: "maze", re: /maze|labyrinth|pac-?man|corridor/ },
  { mechanic: "rhythm", re: /rhythm|beat|note|music|timing bar/ },
  { mechanic: "aim", re: /aim|throw|sling|golf|cannon|angle/ },
  { mechanic: "stacker", re: /stack|tetris|drop.?block|build.?tower/ },
  { mechanic: "runner", re: /runner|endless run|auto.?run|dash/ },
  { mechanic: "memory", re: /memory|simon|sequence|match.?pair/ },
  { mechanic: "collector", re: /catch|collect|gather|coin|drip/ },
  { mechanic: "dodge", re: /dodge|weave/ },
];

export const FAMOUS: {
  re: RegExp;
  mechanic: Mechanic;
  title: string;
  player: string;
  hazards: string;
  controls: string;
  brief: string;
}[] = [
  {
    re: /\bdoom\b|wolfenstein|quake/,
    mechanic: "fps",
    title: "DOOM",
    player: "shotgun at the bottom of a first-person view",
    hazards: "imps/demons in corridors",
    controls: "WASD move, arrows turn, click shoot",
    brief: "First-person 2.5D DDA raycaster. Grid maze, textured-looking wall columns, floor/ceiling split, shotgun sprite, demon billboards, HP/kills. NOT top-down, NOT snake, NOT falling objects.",
  },
  {
    re: /\bmario\b/,
    mechanic: "platformer",
    title: "MARIO",
    player: "small plumber with cap and mustache",
    hazards: "pits and walking mushrooms",
    controls: "arrows move, up/click jump",
    brief: "Side-view platformer with gravity, solid blocks, goomba stomps.",
  },
  {
    re: /\btetris\b/,
    mechanic: "stacker",
    title: "TETRIS",
    player: "falling tetrominoes",
    hazards: "stack reaching the top",
    controls: "arrows move/rotate, down drop",
    brief: "Tetromino stacker. Shapes, line clears, rising speed.",
  },
  {
    re: /\bpac-?man\b/,
    mechanic: "maze",
    title: "PAC-MAN",
    player: "yellow pie-mouth",
    hazards: "colored ghosts",
    controls: "arrows through a pellet maze",
    brief: "Top-down maze, pellets, ghosts. Not a dodge-falling game.",
  },
  {
    re: /\bflappy\b/,
    mechanic: "flappy",
    title: "FLAPPY",
    player: "chunky bird",
    hazards: "pipe gaps",
    controls: "click/space flap",
    brief: "Fixed X, gravity, flap, pipes.",
  },
];

export const MECHANIC_RECIPES: Record<Mechanic, string> = {
  fps: "LOOP: first-person raycaster. px,py,pa. WASD move with collision on a grid map of 0/1 walls. Arrows turn pa. For each screen column, cast a ray (step along cos/sin until wall) and fillRect a vertical strip whose height is H/dist. Draw floor/ceiling split. Demons as scaled rects by distance+angle. Click shoots along pa. HUD HP + kills. FORBIDDEN: top-down snake, mouse-dodge, falling circles.",
  snake:
    "LOOP: cell grid (~16px). snake=[{x,y},…], dir, food. Every few frames prepend a new head and pop the tail unless food was eaten (then s++). Die on wall or overlapping a body cell. Arrows/WASD change dir (block 180° reverse). Mouse does NOT steer the head.",
  flappy:
    "LOOP: py+=vy; vy+=gravity; click/space sets vy to a negative flap. Obstacles with a gap scroll left. Score when you pass a gap. Die on obstacle/ground/ceiling. Horizontal position is fixed — not mouse-follow.",
  shooter:
    "LOOP: ship near bottom, px follows pointer X. Click/space pushes bullets upward. Hostiles spawn and move. AABB bullet-vs-hostile (s++ and burst). Die if a hostile hits the ship. You MUST shoot; dodging alone is a fail.",
  platformer:
    "LOOP: gravity + jump on click/up if grounded. Solid rect platforms. Move with arrows/pointer. Die on hazard or falling out. Score by distance or coins.",
  frogger:
    "LOOP: frog hops one row on arrow/click. Rows are lanes of moving logs/cars. Land on a log to ride it; water/car = death. Reach the far bank to score and reset row. Not a free-move dodge.",
  pong:
    "LOOP: paddle(s) + ball with vx,vy. Bounce on walls/paddle, speed up on hit. Score or die when the ball passes the paddle.",
  breakout:
    "LOOP: paddle + ball + grid of bricks. Ball bounce; brick hit removes brick and scores. Die if ball falls below paddle.",
  dodge:
    "LOOP: ONLY if the idea is literally dodge/avoid. Player follows pointer on one axis. Hazards spawn and move. Hit = death. Still draw the prompt's creatures, not generic blobs.",
  collector:
    "LOOP: catch good items, avoid bad ones. Good = score; bad or missed good = fail. Distinct sprites for good vs bad.",
  maze:
    "LOOP: grid. Player steps cell-by-cell with arrows. Walls block. Collect dots/key, maybe a chaser. Win/score by pellets; die on chaser.",
  rhythm:
    "LOOP: notes travel toward a hit line. Press a key/click when a note overlaps the line. Early/late miss. Score streaks.",
  aim:
    "LOOP: click/hold sets angle or power, release launches a projectile with gravity. Hit targets to score. Not pointer-follow movement.",
  stacker:
    "LOOP: a moving block. Click to drop/place it on the stack. Misalign shrinks width. Miss completely = game over. Height is score.",
  runner:
    "LOOP: world auto-scrolls. Player grounded, click/up jumps (maybe double). Obstacles approach from the right. Distance is score.",
  memory:
    "LOOP: show a sequence of tiles/colors, then the player repeats it. Wrong tap = fail. Length is score.",
  custom:
    "Invent a loop from the VERBS in the prompt (hop, shoot, eat, stack, match, swim, grow, aim). Do NOT use mouse-follow + falling objects unless those verbs are dodge/avoid/catch.",
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "you",
  "are",
  "was",
  "game",
  "tiny",
  "mini",
  "make",
  "where",
  "when",
  "then",
  "just",
  "like",
  "one",
  "play",
  "please",
  "html",
  "canvas",
  "simple",
  "small",
  "build",
  "create",
  "about",
  "into",
  "over",
  "under",
  "button",
  "click",
  "using",
  "have",
  "will",
  "can",
  "them",
  "they",
  "but",
  "not",
  "any",
  "all",
  "out",
  "get",
  "how",
  "who",
  "why",
  "via",
  "per",
  "through",
  "across",
  "player",
  "arcade",
  "micro",
  "prompt",
]);

export function normalizeIdea(prompt: string): string {
  let text = prompt.trim();
  text = text.replace(/^(hey|hi|yo|please|can you|could you|would you|i want you to|i want|help me|try to)\s+/i, "");
  text = text.replace(/^(make|build|create|write|code|generate|design)\s+(me\s+)?(a |an |the )?/i, "");
  text = text.replace(/\b(a game|an html5 game|please|thanks)\b/gi, " ");
  text = text.replace(/[?!]+/g, " ").replace(/\s+/g, " ").trim();
  return text.replace(/\.+$/, "") || prompt.trim();
}

export function famousGame(prompt: string) {
  const value = normalizeIdea(prompt).toLowerCase();
  return FAMOUS.find((entry) => entry.re.test(value)) ?? null;
}

export function pickMechanic(prompt: string): Mechanic {
  const value = normalizeIdea(prompt).toLowerCase();
  const known = famousGame(prompt);
  if (known) return known.mechanic;
  for (const hint of HINTS) {
    if (hint.re.test(value)) return hint.mechanic;
  }
  return "custom";
}

export function genreFromMechanic(mechanic: Mechanic): Exclude<Genre, "All"> {
  if (mechanic === "dodge" || mechanic === "flappy" || mechanic === "rhythm" || mechanic === "runner") {
    return "Reflex";
  }
  if (mechanic === "shooter" || mechanic === "aim" || mechanic === "fps") return "Action";
  if (mechanic === "maze" || mechanic === "memory" || mechanic === "stacker") return "Puzzle";
  return "Arcade";
}

export function themeTokens(prompt: string): string[] {
  return prompt
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3 && !STOP.has(word.toLowerCase()))
    .slice(0, 8);
}

export function parsePlan(raw: string, prompt: string): GamePlan {
  const idea = normalizeIdea(prompt);
  const known = famousGame(idea);
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const blob = fenced?.[1] ?? raw.match(/\{[\s\S]*\}/)?.[0];
  let parsed: Partial<GamePlan> = {};
  if (blob) {
    try {
      parsed = JSON.parse(blob) as Partial<GamePlan>;
    } catch {
      parsed = {};
    }
  }
  const hinted = pickMechanic(idea);
  let mechanic = MECHANICS.includes(parsed.mechanic as Mechanic)
    ? (parsed.mechanic as Mechanic)
    : hinted;
  if (hinted !== "custom") mechanic = hinted;
  const tokens = themeTokens(idea);
  const title = (
    known?.title ??
    parsed.title ??
    tokens.slice(0, 2).join(" ") ??
    "OCG"
  )
    .trim()
    .slice(0, 22)
    .toUpperCase();
  return {
    title: title || "OCG",
    mechanic,
    controls: known?.controls ?? parsed.controls ?? "keyboard and pointer",
    player: known?.player ?? parsed.player ?? tokens[0] ?? "hero",
    hazards: known?.hazards ?? parsed.hazards ?? "obstacles",
    goal: parsed.goal ?? "score and survive",
    fail: parsed.fail ?? "hit a hazard",
    unique: known?.brief ?? parsed.unique ?? idea,
    mustDraw: parsed.mustDraw?.length ? parsed.mustDraw.slice(0, 6) : tokens.slice(0, 4),
    hint: known?.controls ?? parsed.hint ?? parsed.controls ?? "click to start",
  };
}

const DODGE_LERP = /px\s*\+=\s*\(?\s*tx\s*-\s*px/;

export function isGenericDodgeReskin(html: string, mechanic: Mechanic): boolean {
  if (mechanic === "dodge" || mechanic === "collector") return false;
  return DODGE_LERP.test(html) && /y\s*\+=/.test(html) && !hasMechanicSignals(html, mechanic);
}

export function hasMechanicSignals(html: string, mechanic: Mechanic): boolean {
  const text = html.toLowerCase();
  switch (mechanic) {
    case "fps":
      return /(math\.cos|atan2|ray|fov)/.test(text) || /\bpa\b/.test(text);
    case "snake":
      return /(unshift|snake|seg\[|body\[)/.test(text);
    case "flappy":
      return /vy\s*\+=/.test(html) && /(flap|pipe|gap)/.test(text);
    case "shooter":
      return /(bullet|shots?|blts|fire)/.test(text);
    case "frogger":
      return /(log|lane|row|hop)/.test(text);
    case "platformer":
      return /vy\s*\+=/.test(html) && /(ground|plat|jump)/.test(text);
    case "pong":
      return /(paddle|vx|vy)/.test(text);
    case "breakout":
      return /(brick|block)/.test(text);
    case "maze":
      return /(grid|cell|tile|wall)/.test(text);
    case "rhythm":
      return /(note|beat|hit)/.test(text);
    case "aim":
      return /(angle|power|proj|throw)/.test(text);
    case "stacker":
      return /(stack|drop)/.test(text);
    case "runner":
      return /(jump|obs|scroll)/.test(text);
    case "memory":
      return /(seq|simon|pattern)/.test(text);
    default:
      return true;
  }
}

export function followsTheme(html: string, plan: GamePlan, prompt: string): boolean {
  const lower = html.toLowerCase();
  const tokens = [...plan.mustDraw, ...themeTokens(normalizeIdea(prompt))]
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 3);
  const titleHit = lower.includes(plan.title.toLowerCase().slice(0, Math.min(8, plan.title.length)));
  const hits = tokens.filter((token) => lower.includes(token)).length;
  if (tokens.length <= 1) return titleHit || hits >= 1;
  return titleHit || hits >= Math.min(2, tokens.length);
}

export function tickerFromPlan(plan: GamePlan): { name: string; symbol: string } {
  const words = plan.title
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  const name = words
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 32);
  const symbol = (words[words.length - 1] ?? "OCG").slice(0, 6).toUpperCase();
  return { name: name || "OnChain Game", symbol };
}

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
  fantasy: string;
  camera: string;
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
  camera: string;
  brief: string;
}[] = [
  {
    re: /\bdoom\b|wolfenstein|quake/,
    mechanic: "fps",
    title: "DOOM",
    player: "shotgun sprite covering the bottom of a first-person view",
    hazards: "imps and demons in brick corridors",
    controls: "WASD move, arrows/mouse turn, click shoot",
    camera: "first-person",
    brief: "First-person 2.5D DDA raycaster through a labyrinth. Ceiling/floor split, wall columns by distance, shotgun in the foreground, demon sprites that scale with depth, HP and kills. WASD + turn + click. This is DOOM, not a top-down arcade.",
  },
  {
    re: /\bmario\b/,
    mechanic: "platformer",
    title: "MARIO",
    player: "small plumber with cap, mustache, overalls",
    hazards: "pits and walking mushrooms",
    controls: "arrows move, up/click jump",
    camera: "side-view",
    brief: "Side-scrolling platformer: gravity, solid blocks, coins, goomba stomps, flag/goal. Never a top-down dodge game.",
  },
  {
    re: /\btetris\b/,
    mechanic: "stacker",
    title: "TETRIS",
    player: "falling tetrominoes (I,O,T,L,J,S,Z)",
    hazards: "the stack reaching the top",
    controls: "arrows move/rotate, down drop",
    camera: "side-view grid",
    brief: "Seven tetrominoes, rotate, lock, clear full rows, speed ramps. Not falling circles.",
  },
  {
    re: /\bpac-?man\b/,
    mechanic: "maze",
    title: "PAC-MAN",
    player: "yellow pie-mouth that chomps",
    hazards: "colored ghosts",
    controls: "arrows through a pellet maze",
    camera: "top-down",
    brief: "Top-down maze, pellets, four ghosts, wrap tunnels. Not a dodge-falling game.",
  },
  {
    re: /\bflappy\b/,
    mechanic: "flappy",
    title: "FLAPPY",
    player: "chunky bird with wing and beak",
    hazards: "pipe gaps",
    controls: "click/space flap",
    camera: "side-view",
    brief: "Fixed X, gravity, flap, scrolling pipe gaps, score on pass.",
  },
  {
    re: /\bsnake\b|\bsnek\b/,
    mechanic: "snake",
    title: "SNAKE",
    player: "growing segmented snake",
    hazards: "walls and your own tail",
    controls: "arrows/WASD, no 180 reverse",
    camera: "top-down grid",
    brief: "Grid snake: grow on food, die on self/wall, rising tick speed.",
  },
  {
    re: /\bpong\b/,
    mechanic: "pong",
    title: "PONG",
    player: "glowing paddle",
    hazards: "missing the ball",
    controls: "arrows or mouse on the paddle",
    camera: "side-view",
    brief: "Two paddles, bouncing ball, speed-up, score. Tennis, not dodge.",
  },
  {
    re: /\bbreakout\b|\barkanoid\b/,
    mechanic: "breakout",
    title: "BREAKOUT",
    player: "bottom paddle",
    hazards: "ball falling off screen",
    controls: "arrows/mouse move paddle",
    camera: "side-view",
    brief: "Paddle, ball, colored brick grid that vanishes on hit.",
  },
  {
    re: /\bfrogger\b/,
    mechanic: "frogger",
    title: "FROGGER",
    player: "frog with legs",
    hazards: "cars and drowning",
    controls: "arrow hop one tile",
    camera: "top-down lanes",
    brief: "Hop lanes of cars then ride logs. Far bank scores. Not falling objects.",
  },
  {
    re: /space.?invader|galaga|galaxian/,
    mechanic: "shooter",
    title: "INVADERS",
    player: "cannon at the bottom",
    hazards: "descending alien grid",
    controls: "arrows move, space/click fire",
    camera: "rail shooter",
    brief: "Bottom cannon vs marching alien rows, shields, fire bullets up.",
  },
];

export function cameraFor(mechanic: Mechanic): string {
  switch (mechanic) {
    case "fps":
      return "first-person";
    case "flappy":
    case "platformer":
    case "runner":
    case "aim":
    case "pong":
    case "breakout":
    case "stacker":
      return "side-view";
    case "snake":
    case "frogger":
    case "maze":
    case "memory":
      return "top-down";
    case "shooter":
      return "top-down or rail";
    default:
      return "the camera that idea is famous for";
  }
}

export const MECHANIC_RECIPES: Record<Mechanic, string> = {
  fps: `CAMERA: first-person. LOOP: px,py,pa on a 1/0 grid. WASD with wall collision, arrows turn. For each column, step a ray along cos/sin until a wall and draw a vertical strip height H/dist (shade by distance). Ceiling vs floor colors. Enemies are scaled billboards by angle+distance. Click shoots a hitscan along pa. HP, ammo or kills. Rooms, not an empty box.`,
  snake: `CAMERA: top-down grid. LOOP: snake as [{x,y}…]. Tick: unshift head, pop tail unless food eaten (grow + score). Die on wall or self. Arrows/WASD, no 180 reverse. Food, wrap or walls, rising speed. The body must look like a snake, not dots.`,
  flappy: `CAMERA: side scroller, player X fixed. LOOP: py+=vy; vy+=gravity; click/space flaps vy negative. Pipes with gaps scroll left. Score on pass. Die on pipe/ground/ceiling. Bird with wing/beak, not a circle.`,
  shooter: `CAMERA: top-down or rail shooter. LOOP: ship, bullets you fire, enemies that shoot or dive. Click/space fire is mandatory. Collisions score/kill. Stars, ship triangle, distinct enemy shapes. Gets denser over time.`,
  platformer: `CAMERA: side view. LOOP: gravity, jump if grounded, run with arrows. Solid platforms, pits, stomps or coins. Character with a silhouette (hat, legs), not a square.`,
  frogger: `CAMERA: top-down lanes. LOOP: hop one row per input. Moving logs/cars. Water/car = death. Far bank scores and resets. Frog with legs, logs that carry you.`,
  pong: `CAMERA: side. LOOP: paddle + ball vx/vy, bounce, speed up, score or miss. Glow trail on the ball. Feels like tennis, not dodge.`,
  breakout: `CAMERA: side. LOOP: paddle, ball, brick grid. Bricks vanish and score. Ball drops = death. Color rows of bricks.`,
  dodge: `CAMERA: whatever fits the idea (often chase-cam top-down). LOOP: only if the idea is dodge/avoid. Player follows one axis. Hazards match the prompt (moons, not red circles). Survival score, ramp.`,
  collector: `CAMERA: usually side or top. LOOP: catch good, avoid bad, miss-good may fail. Two clearly different item sprites.`,
  maze: `CAMERA: top-down grid. LOOP: cell steps, walls, pellets, a chaser. Pac-Man DNA if they asked for it.`,
  rhythm: `CAMERA: highway or pads. LOOP: notes approach a hit line, tap in time, streak score.`,
  aim: `CAMERA: side. LOOP: angle/power, projectile with gravity, targets. Golf/cannon/sling feel.`,
  stacker: `CAMERA: side. LOOP: sliding block, click to drop onto the stack, shrink on miss, height is score. Tetris if they asked: tetrominoes + line clear.`,
  runner: `CAMERA: side auto-scroll. LOOP: jump obstacles, distance score, rising speed.`,
  memory: `CAMERA: pads. LOOP: show a sequence, player repeats, length is score. Lit pads, not falling objects.`,
  custom: `Invent the camera and loop from the player's fantasy and verbs. If they named a known game, steal its camera. Never default to mouse-dodge falling circles.`,
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
    fantasy: parsed.fantasy ?? known?.brief ?? `You are playing ${idea}`,
    camera: parsed.camera ?? known?.camera ?? cameraFor(mechanic),
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

export function isThinRom(html: string): boolean {
  return (
    html.length < 8000 ||
    !/requestAnimationFrame/.test(html) ||
    !/fillText/.test(html) ||
    !/(game.?over|best)/i.test(html)
  );
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

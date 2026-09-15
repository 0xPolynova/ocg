import type { Genre } from "@/lib/constants";

export const MECHANICS = [
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
  { mechanic: "snake", re: /snake|snek|nibble|slither|tail/ },
  { mechanic: "flappy", re: /flappy|flap|tap.?jump|bird.*pipe|helicopter/ },
  { mechanic: "shooter", re: /shoot|blast|asteroid|space.?ship|bullet|gun|invader|fire/ },
  { mechanic: "frogger", re: /frog|log|lane|cross(ing)? (the |a )?(road|canal|river|highway)/ },
  { mechanic: "platformer", re: /platform|jump|hop|leap|mario/ },
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

export const MECHANIC_RECIPES: Record<Mechanic, string> = {
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

export function pickMechanic(prompt: string): Mechanic {
  const value = prompt.toLowerCase();
  for (const hint of HINTS) {
    if (hint.re.test(value)) return hint.mechanic;
  }
  return "custom";
}

export function genreFromMechanic(mechanic: Mechanic): Exclude<Genre, "All"> {
  if (mechanic === "dodge" || mechanic === "flappy" || mechanic === "rhythm" || mechanic === "runner") {
    return "Reflex";
  }
  if (mechanic === "shooter" || mechanic === "aim") return "Action";
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
  const mechanic = MECHANICS.includes(parsed.mechanic as Mechanic)
    ? (parsed.mechanic as Mechanic)
    : pickMechanic(prompt);
  const tokens = themeTokens(prompt);
  const title = (parsed.title ?? tokens.slice(0, 2).join(" ") ?? "OCG").trim().slice(0, 22).toUpperCase();
  return {
    title: title || "OCG",
    mechanic,
    controls: parsed.controls ?? "keyboard and pointer",
    player: parsed.player ?? tokens[0] ?? "hero",
    hazards: parsed.hazards ?? "obstacles",
    goal: parsed.goal ?? "score and survive",
    fail: parsed.fail ?? "hit a hazard",
    unique: parsed.unique ?? prompt,
    mustDraw: parsed.mustDraw?.length ? parsed.mustDraw.slice(0, 6) : tokens.slice(0, 4),
    hint: parsed.hint ?? parsed.controls ?? "click to start",
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
  const titleHit = lower.includes(plan.title.toLowerCase().slice(0, 8));
  const tokens = [...plan.mustDraw, ...themeTokens(prompt)].map((token) => token.toLowerCase());
  const hits = tokens.filter((token) => token.length > 3 && lower.includes(token)).length;
  return titleHit || hits >= Math.min(2, tokens.length || 1);
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

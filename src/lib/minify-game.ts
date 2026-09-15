export function minifyGameHtml(input: string): string {
  let html = input.trim();
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/```$/i, "").trim();
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/\/\*[\s\S]*?\*\//g, "");
  html = html.replace(/(^|[^:\\\s])\/\/.*$/gm, "$1");
  html = html.replace(/\n+/g, "\n");
  html = html.replace(/[ \t]{2,}/g, " ");
  html = html.replace(/>\s+</g, "><");
  return html.trim();
}

export function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return minifyGameHtml(fenced[1]);
  const doc = text.match(/<!doctype html[\s\S]*/i) ?? text.match(/<html[\s\S]*/i);
  if (doc?.[0]) return minifyGameHtml(doc[0]);
  return minifyGameHtml(text);
}

export function inferGenre(prompt: string): "Arcade" | "Action" | "Puzzle" | "Reflex" | "Custom" {
  const value = prompt.toLowerCase();
  if (/(dodge|reflex|reaction|flappy|weave|avoid)/.test(value)) return "Reflex";
  if (/(puzzle|match|slide|sokoban)/.test(value)) return "Puzzle";
  if (/(shoot|slash|fight|action|blast)/.test(value)) return "Action";
  if (/(pong|catch|jump|arcade|snake|collect)/.test(value)) return "Arcade";
  return "Custom";
}

const STOPWORDS = new Set([
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
  "a",
  "an",
]);

export function inferTicker(prompt: string): { name: string; symbol: string } {
  const words = prompt
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOPWORDS.has(word.toLowerCase()));
  const pick = words.slice(-2);
  const name =
    pick.length > 0
      ? pick.map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase()).join(" ")
      : "OnChain Game";
  const symbol = (pick[pick.length - 1] ?? words[0] ?? "OCG").slice(0, 6).toUpperCase();
  return { name, symbol };
}

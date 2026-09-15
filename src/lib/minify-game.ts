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
  if (/(dodge|reflex|reaction|flappy)/.test(value)) return "Reflex";
  if (/(puzzle|match|slide|sokoban)/.test(value)) return "Puzzle";
  if (/(shoot|slash|fight|action)/.test(value)) return "Action";
  if (/(pong|catch|jump|arcade|snake)/.test(value)) return "Arcade";
  return "Custom";
}

export function inferTicker(prompt: string): { name: string; symbol: string } {
  const words = prompt
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const name = words.slice(0, 2).join(" ") || "OnChain Game";
  const symbol = (words[0] ?? "OCG").slice(0, 6).toUpperCase();
  return { name, symbol };
}

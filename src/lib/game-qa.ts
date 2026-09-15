import { extractGameScript } from "./wrap-game";

export function diagnoseGame(html: string): string[] {
  const issues: string[] = [];
  const script = extractGameScript(html);

  if (!/<canvas[\s>]/i.test(html)) issues.push("Missing a <canvas> element.");
  if (!/requestAnimationFrame/.test(html) && !/setInterval\s*\(/.test(html)) {
    issues.push("No game loop — must call requestAnimationFrame every frame.");
  }
  if (
    !/onkeydown|onkeyup|onpointerdown|onmousedown|onclick|ontouchstart|addEventListener\(\s*['"]key|addEventListener\(\s*['"]pointer|addEventListener\(\s*['"]click|addEventListener\(\s*['"]touch|addEventListener\(\s*['"]mouse/.test(
      html,
    )
  ) {
    issues.push("No player input (keyboard, click, or pointer).");
  }
  if (script.length < 900) {
    issues.push(`Game script is only ${script.length} characters — too small to be a finished playable game.`);
  }
  if (/\b(let|const|var|function)\s+(shake|beep|burst)\b/.test(script)) {
    issues.push("Do not declare beep, burst, or shake — the host already provides them as globals.");
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(script);
  } catch (error) {
    issues.push(`JavaScript does not parse: ${error instanceof Error ? error.message : String(error)}`);
  }

  return issues;
}

export function gameLooksPlayable(html: string): boolean {
  return diagnoseGame(html).length === 0;
}

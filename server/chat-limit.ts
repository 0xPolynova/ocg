import type { Request } from "express";

import { CHAT_COOLDOWN_MS, CHAT_MAX_USER_MESSAGES } from "../src/lib/constants";

type GenerateMessage = { role?: unknown; content?: unknown };

const lastByIp = new Map<string, number>();

function prune(now: number): void {
  for (const [ip, at] of lastByIp) {
    if (now - at > CHAT_COOLDOWN_MS * 8) lastByIp.delete(ip);
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(forwarded) && typeof forwarded[0] === "string") {
    return forwarded[0].split(",")[0]?.trim() || "unknown";
  }
  return req.socket?.remoteAddress || "unknown";
}

export function userMessageCount(prompt: string, messages: GenerateMessage[] | undefined): number {
  if (Array.isArray(messages) && messages.length > 0) {
    const users = messages.filter((item) => item.role === "user").length;
    if (users > 0) return users;
  }
  return prompt.trim() ? 1 : 0;
}

export function checkGenerateLimit(args: {
  ip: string;
  prompt: string;
  messages: GenerateMessage[] | undefined;
}): { ok: true } | { ok: false; status: number; error: string; retryAfter?: number } {
  const now = Date.now();
  prune(now);
  const count = userMessageCount(args.prompt, args.messages);
  if (count > CHAT_MAX_USER_MESSAGES) {
    return {
      ok: false,
      status: 429,
      error: `This game used all ${CHAT_MAX_USER_MESSAGES} prompts. Open a new tab to start another.`,
    };
  }
  const last = lastByIp.get(args.ip) ?? 0;
  const waitMs = CHAT_COOLDOWN_MS - (now - last);
  if (waitMs > 0) {
    const retryAfter = Math.ceil(waitMs / 1000);
    return {
      ok: false,
      status: 429,
      error: `Wait ${retryAfter}s before sending another prompt.`,
      retryAfter,
    };
  }
  lastByIp.set(args.ip, now);
  return { ok: true };
}

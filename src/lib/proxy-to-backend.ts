import { NextRequest, NextResponse } from "next/server";

import { backendOrigin } from "@/lib/api";

export async function proxyToBackend(request: NextRequest, backendPath: string) {
  const target = `${backendOrigin()}${backendPath}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
    signal: AbortSignal.timeout(175_000),
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(target, init);
    const body = await response.arrayBuffer();
    const responseType = response.headers.get("content-type") ?? "";
    if (responseType.includes("text/html") || looksLikeHtml(body)) {
      return NextResponse.json(
        { error: `Game API at ${backendOrigin()} returned a web page (${response.status}). Is ocg-api live?` },
        { status: 502 },
      );
    }
    const out = new Headers();
    if (responseType) out.set("content-type", responseType);
    return new NextResponse(body, { status: response.status, headers: out });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Game API timed out. Send the prompt again."
        : error instanceof Error
          ? error.message
          : "Could not reach the game API.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function looksLikeHtml(body: ArrayBuffer): boolean {
  const head = new TextDecoder().decode(body.slice(0, 24)).trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

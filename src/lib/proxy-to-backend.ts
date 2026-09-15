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
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(target, init);
  const body = await response.arrayBuffer();
  const out = new Headers();
  const responseType = response.headers.get("content-type");
  if (responseType) out.set("content-type", responseType);
  return new NextResponse(body, { status: response.status, headers: out });
}

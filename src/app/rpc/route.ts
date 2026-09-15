import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/proxy-to-backend";

export function POST(request: NextRequest) {
  return proxyToBackend(request, "/rpc");
}

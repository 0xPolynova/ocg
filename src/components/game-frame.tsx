"use client";

import { useEffect, useMemo, useRef } from "react";

import { wrapGameHtml } from "@/lib/wrap-game";

export function GameFrame({
  html,
  title,
  onShot,
}: {
  html: string;
  title: string;
  onShot?: (dataUrl: string) => void;
}) {
  const shotRef = useRef(onShot);
  const srcDoc = useMemo(() => wrapGameHtml(html), [html]);
  shotRef.current = onShot;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; dataUrl?: string } | null;
      if (data?.type !== "ocg-shot" || typeof data.dataUrl !== "string") return;
      shotRef.current?.(data.dataUrl);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [html]);

  return (
    <div className="absolute inset-0 min-h-0 min-w-0 overflow-hidden bg-background">
      <iframe
        title={title}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="absolute inset-0 block h-full w-full border-0 bg-background"
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const host = useRef<HTMLDivElement>(null);
  const shotRef = useRef(onShot);
  const [ready, setReady] = useState(false);
  const srcDoc = useMemo(() => wrapGameHtml(html), [html]);
  shotRef.current = onShot;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 120 && rect.height >= 80) setReady(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    <div ref={host} className="absolute inset-0 min-h-0 min-w-0 overflow-hidden bg-[#041014]">
      {ready ? (
        <iframe
          title={title}
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className="absolute inset-0 block h-full w-full border-0 bg-[#041014]"
        />
      ) : null}
    </div>
  );
}

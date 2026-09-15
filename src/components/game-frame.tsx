"use client";

import { useMemo } from "react";

import { wrapGameHtml } from "@/lib/wrap-game";

export function GameFrame({ html, title }: { html: string; title: string }) {
  const srcDoc = useMemo(() => wrapGameHtml(html), [html]);

  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="h-full w-full rounded-[inherit] border-0 bg-black"
    />
  );
}

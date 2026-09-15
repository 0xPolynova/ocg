"use client";

export function GameFrame({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      srcDoc={html}
      className="h-full w-full rounded-[inherit] border-0 bg-black"
    />
  );
}

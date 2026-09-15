"use client";

import { useParams } from "next/navigation";

import { PlayByKey } from "@/components/play-by-key";

export default function TickerPlayPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  return <PlayByKey lookup={slug} />;
}

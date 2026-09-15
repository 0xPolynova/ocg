"use client";

import { useParams } from "next/navigation";

import { PlayByKey } from "@/components/play-by-key";

export default function PlayMintPage() {
  const params = useParams<{ mint: string }>();
  const mint = Array.isArray(params.mint) ? params.mint[0] : params.mint;
  return <PlayByKey lookup={mint} />;
}

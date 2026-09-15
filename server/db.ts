import { Pool } from "pg";

import type { Genre } from "../src/lib/constants";
import { publicPlayUrl } from "../src/lib/site";
import type { OcgLaunch } from "../src/lib/types";

type LaunchRow = {
  id: string;
  mint: string | null;
  name: string;
  symbol: string;
  description: string;
  prompt: string;
  genre: OcgLaunch["genre"];
  game_html: string;
  game_bytes: number;
  compressed_bytes: number;
  image: string | null;
  creator: string | null;
  store_signatures: string[];
  create_signature: string | null;
  created_at: string | number;
  demo: boolean;
  market_cap_usd: number | null;
  volume_usd: number | null;
  change_24h: number | null;
  sparkline: number[];
};

const memory = new Map<string, OcgLaunch>();
let pool: Pool | null | undefined;
let schemaReady: Promise<void> | null = null;

function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL?.trim() || undefined;
}

function getPool(): Pool | null {
  const url = databaseUrl();
  if (!url) return null;
  if (pool === undefined) {
    const needsSsl = /render\.com|sslmode=require/.test(url);
    pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool ?? null;
}

function fromRow(row: LaunchRow): OcgLaunch {
  return {
    id: row.id,
    mint: row.mint ?? undefined,
    name: row.name,
    symbol: row.symbol,
    description: row.description,
    prompt: row.prompt,
    genre: row.genre,
    gameHtml: row.game_html,
    gameBytes: Number(row.game_bytes),
    compressedBytes: Number(row.compressed_bytes),
    image: row.image ?? undefined,
    creator: row.creator ?? undefined,
    playUrl: row.mint ? publicPlayUrl(row.mint) : undefined,
    storeSignatures: row.store_signatures ?? [],
    createSignature: row.create_signature ?? undefined,
    createdAt: Number(row.created_at),
    demo: row.demo || undefined,
    marketCapUsd: row.market_cap_usd ?? undefined,
    volumeUsd: row.volume_usd ?? undefined,
    change24h: row.change_24h ?? undefined,
    sparkline: row.sparkline ?? [],
  };
}

export async function ensureLaunchSchema(): Promise<void> {
  const db = getPool();
  if (!db) return;
  if (!schemaReady) {
    schemaReady = db
      .query(
        `CREATE TABLE IF NOT EXISTS launches (
          id TEXT PRIMARY KEY,
          mint TEXT,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          prompt TEXT NOT NULL DEFAULT '',
          genre TEXT NOT NULL,
          game_html TEXT NOT NULL,
          game_bytes INTEGER NOT NULL,
          compressed_bytes INTEGER NOT NULL,
          image TEXT,
          creator TEXT,
          store_signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
          create_signature TEXT,
          created_at BIGINT NOT NULL,
          demo BOOLEAN NOT NULL DEFAULT FALSE,
          market_cap_usd DOUBLE PRECISION,
          volume_usd DOUBLE PRECISION,
          change_24h DOUBLE PRECISION,
          sparkline JSONB NOT NULL DEFAULT '[]'::jsonb
        );
        CREATE INDEX IF NOT EXISTS launches_created_at_idx ON launches (created_at DESC);
        CREATE INDEX IF NOT EXISTS launches_mint_idx ON launches (mint);`,
      )
      .then(() => undefined);
  }
  await schemaReady;
}

export async function listLaunches(): Promise<OcgLaunch[]> {
  await ensureLaunchSchema();
  const db = getPool();
  if (!db) {
    return [...memory.values()].sort((a, b) => b.createdAt - a.createdAt);
  }
  const result = await db.query<LaunchRow>("SELECT * FROM launches ORDER BY created_at DESC LIMIT 200");
  return result.rows.map(fromRow);
}

export async function getLaunch(id: string): Promise<OcgLaunch | null> {
  await ensureLaunchSchema();
  const db = getPool();
  if (!db) {
    return (
      [...memory.values()].find((item) => item.id === id || item.mint === id || item.symbol === id) ?? null
    );
  }
  const result = await db.query<LaunchRow>(
    "SELECT * FROM launches WHERE id = $1 OR mint = $1 OR symbol = $1 LIMIT 1",
    [id],
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function upsertLaunchRecord(launch: OcgLaunch): Promise<OcgLaunch> {
  await ensureLaunchSchema();
  const db = getPool();
  if (!db) {
    memory.set(launch.id, launch);
    return launch;
  }
  await db.query(
    `INSERT INTO launches (
      id, mint, name, symbol, description, prompt, genre, game_html, game_bytes, compressed_bytes,
      image, creator, store_signatures, create_signature, created_at, demo, market_cap_usd, volume_usd,
      change_24h, sparkline
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19,$20::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      mint = EXCLUDED.mint,
      name = EXCLUDED.name,
      symbol = EXCLUDED.symbol,
      description = EXCLUDED.description,
      prompt = EXCLUDED.prompt,
      genre = EXCLUDED.genre,
      game_html = EXCLUDED.game_html,
      game_bytes = EXCLUDED.game_bytes,
      compressed_bytes = EXCLUDED.compressed_bytes,
      image = EXCLUDED.image,
      creator = EXCLUDED.creator,
      store_signatures = EXCLUDED.store_signatures,
      create_signature = EXCLUDED.create_signature,
      demo = EXCLUDED.demo,
      market_cap_usd = EXCLUDED.market_cap_usd,
      volume_usd = EXCLUDED.volume_usd,
      change_24h = EXCLUDED.change_24h,
      sparkline = EXCLUDED.sparkline`,
    [
      launch.id,
      launch.mint ?? null,
      launch.name,
      launch.symbol,
      launch.description,
      launch.prompt,
      launch.genre,
      launch.gameHtml,
      launch.gameBytes,
      launch.compressedBytes,
      launch.image ?? null,
      launch.creator ?? null,
      JSON.stringify(launch.storeSignatures ?? []),
      launch.createSignature ?? null,
      launch.createdAt,
      Boolean(launch.demo),
      launch.marketCapUsd ?? null,
      launch.volumeUsd ?? null,
      launch.change24h ?? null,
      JSON.stringify(launch.sparkline ?? []),
    ],
  );
  return launch;
}

export function parseLaunchBody(body: unknown): OcgLaunch | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Partial<OcgLaunch>;
  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.symbol !== "string") {
    return null;
  }
  if (typeof value.gameHtml !== "string") return null;
  const rawGenre = typeof value.genre === "string" ? value.genre : "Custom";
  const genre: OcgLaunch["genre"] = (
    ["Arcade", "Action", "Puzzle", "Reflex", "Custom"] as const
  ).includes(rawGenre as Exclude<Genre, "All">)
    ? (rawGenre as Exclude<Genre, "All">)
    : "Custom";
  return {
    id: value.id,
    name: value.name.slice(0, 32),
    symbol: value.symbol.slice(0, 10),
    description: typeof value.description === "string" ? value.description.slice(0, 400) : "",
    prompt: typeof value.prompt === "string" ? value.prompt.slice(0, 500) : "",
    genre,
    gameHtml: value.gameHtml,
    gameBytes: Number(value.gameBytes ?? 0),
    compressedBytes: Number(value.compressedBytes ?? 0),
    image: typeof value.image === "string" ? value.image : undefined,
    mint: typeof value.mint === "string" ? value.mint : undefined,
    creator: typeof value.creator === "string" ? value.creator : undefined,
    playUrl:
      typeof value.playUrl === "string"
        ? value.playUrl
        : typeof value.mint === "string"
          ? publicPlayUrl(value.mint)
          : undefined,
    storeSignatures: Array.isArray(value.storeSignatures)
      ? value.storeSignatures.filter((item): item is string => typeof item === "string")
      : [],
    createSignature: typeof value.createSignature === "string" ? value.createSignature : undefined,
    createdAt: Number(value.createdAt ?? Date.now()),
    demo: Boolean(value.demo),
    marketCapUsd: typeof value.marketCapUsd === "number" ? value.marketCapUsd : undefined,
    volumeUsd: typeof value.volumeUsd === "number" ? value.volumeUsd : undefined,
    change24h: typeof value.change24h === "number" ? value.change24h : undefined,
    sparkline: Array.isArray(value.sparkline)
      ? value.sparkline.filter((item): item is number => typeof item === "number")
      : [],
  };
}

import cors from "cors";
import { config as loadEnv } from "dotenv";
import express from "express";
import multer from "multer";

import { generateGameFromPrompt } from "../src/lib/generate-game";
import type { PumpCoinStats } from "../src/lib/types";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const PUMP_ENDPOINTS = [
  "https://pump.fun/api/ipfs",
  "https://frontend-api-v3.pump.fun/ipfs",
];
const PUMP_FUN_API = "https://frontend-api-v3.pump.fun";
const SOLANA_RPC =
  process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2_000_000 } });
const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        origin.includes("localhost") ||
        origin.endsWith(".onrender.com") ||
        origin.endsWith("launchocg.com")
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ocg-api" });
});

app.post("/api/generate-game", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
  const result = await generateGameFromPrompt(prompt);
  res.status(result.status).json(result.body);
});

app.get("/api/pump/:mint", async (req, res) => {
  try {
    const response = await fetch(`${PUMP_FUN_API}/coins/${req.params.mint}`);
    if (!response.ok) {
      res.status(response.status).json(null);
      return;
    }
    const stats = (await response.json()) as PumpCoinStats;
    res.json(stats);
  } catch {
    res.status(502).json(null);
  }
});

app.post("/api/ipfs", upload.single("file"), async (req, res) => {
  const name = String(req.body.name ?? "OCG");
  const symbol = String(req.body.symbol ?? "OCG");
  const description = String(req.body.description ?? "");
  const form = new FormData();
  form.append("name", name);
  form.append("symbol", symbol);
  form.append("description", description);
  form.append("twitter", String(req.body.twitter ?? ""));
  form.append("telegram", String(req.body.telegram ?? ""));
  form.append("website", String(req.body.website ?? ""));
  form.append("showName", "true");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="40" fill="#0c1719"/><text x="128" y="148" text-anchor="middle" fill="#8fd4de" font-size="42" font-family="Arial,sans-serif">$${symbol.slice(0, 6)}</text></svg>`;
  const file = req.file
    ? new File([new Uint8Array(req.file.buffer)], req.file.originalname || `${symbol}.png`, {
        type: req.file.mimetype || "application/octet-stream",
      })
    : new File([svg], `${symbol}.svg`, { type: "image/svg+xml" });
  form.append("file", file);

  for (const url of PUMP_ENDPOINTS) {
    try {
      const response = await fetch(url, { method: "POST", body: form });
      if (!response.ok) continue;
      const json = (await response.json()) as {
        metadataUri?: string;
        metadata_uri?: string;
        uri?: string;
      };
      const uri = json.metadataUri ?? json.metadata_uri ?? json.uri;
      if (uri) {
        res.json({ uri });
        return;
      }
    } catch {
      // try the next endpoint
    }
  }

  const metadata = {
    name,
    symbol,
    description,
    image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
  };
  res.json({
    uri: `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`,
    fallback: true,
  });
});

app.post("/rpc", async (req, res) => {
  try {
    const response = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.status(response.status).type("application/json").send(text);
  } catch {
    res.status(502).json({ error: "Solana RPC proxy failed." });
  }
});

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
app.listen(port, "0.0.0.0", () => {
  console.log(`OCG API listening on ${port}`);
});

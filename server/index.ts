import cors from "cors";
import { config as loadEnv } from "dotenv";
import express from "express";
import multer from "multer";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import { generateGameFromChat } from "../src/lib/generate-game";
import { buildMintSignedPumpCreateTx } from "../src/lib/pump-create-tx";
import { maxPumpBuySol, pumpLaunchBudget } from "../src/lib/pump-curve";
import { HELIUS_RPC_HTTP } from "../src/lib/solana-rpc";
import { checkGenerateLimit, clientIp } from "./chat-limit";
import { ensureLaunchSchema, getLaunch, listLaunches, parseLaunchBody, upsertLaunchRecord } from "./db";
import { getMarketCapCache, overlayMarketCaps, startMarketCapPoller } from "./market-caps";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const PUMP_ENDPOINTS = [
  "https://pump.fun/api/ipfs",
  "https://frontend-api-v3.pump.fun/ipfs",
];
const SOLANA_RPC = process.env.SOLANA_RPC ?? HELIUS_RPC_HTTP;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2_000_000 } });
const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".onrender.com") ||
      host === "launchocg.com" ||
      host.endsWith(".launchocg.com")
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"));
    },
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ocg-api", db: Boolean(process.env.DATABASE_URL) });
});

app.get("/api/launches", async (_req, res) => {
  try {
    const launches = overlayMarketCaps(await listLaunches());
    res.json(launches);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not list launches." });
  }
});

app.get("/api/launches/:id", async (req, res) => {
  try {
    const launch = await getLaunch(String(req.params.id ?? ""));
    res.json(launch ? overlayMarketCaps([launch])[0] : null);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not load launch." });
  }
});

app.post("/api/launches", async (req, res) => {
  const launch = parseLaunchBody(req.body);
  if (!launch) {
    res.status(400).json({ error: "Launch is missing name, ticker, or ROM." });
    return;
  }
  try {
    const saved = await upsertLaunchRecord(launch);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not save launch." });
  }
});

app.post("/api/generate-game", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : undefined;
  const html = typeof req.body?.html === "string" ? req.body.html : undefined;
  const name = typeof req.body?.name === "string" ? req.body.name : undefined;
  const symbol = typeof req.body?.symbol === "string" ? req.body.symbol : undefined;
  const mechanic = typeof req.body?.mechanic === "string" ? req.body.mechanic : undefined;
  const limit = checkGenerateLimit({ ip: clientIp(req), prompt, messages });
  if (!limit.ok) {
    if (limit.retryAfter) res.setHeader("Retry-After", String(limit.retryAfter));
    res.status(limit.status).json({ error: limit.error, retryAfter: limit.retryAfter });
    return;
  }
  const result = await generateGameFromChat({ prompt, messages, html, name, symbol, mechanic });
  res.status(result.status).json(result.body);
});

app.get("/api/market-caps", (_req, res) => {
  res.json(getMarketCapCache());
});

app.get("/api/pump/:mint", (req, res) => {
  const mint = String(req.params.mint ?? "");
  const cached = getMarketCapCache()[mint];
  if (cached) {
    res.json({
      usd_market_cap: cached.marketCapUsd,
      market_cap: cached.marketCapUsd,
      volume_24h: cached.volumeUsd,
      price_change_24h: cached.change24h,
    });
    return;
  }
  res.json(null);
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

app.post("/api/pump/create-tx", async (req, res) => {
  try {
    const user = typeof req.body?.user === "string" ? req.body.user : "";
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const symbol = typeof req.body?.symbol === "string" ? req.body.symbol : "";
    const uri = typeof req.body?.uri === "string" ? req.body.uri : "";
    const solBuy = Number(req.body?.solBuy ?? 0);
    const mayhemMode = Boolean(req.body?.mayhemMode);
    const mintSecret = Array.isArray(req.body?.mintSecretKey)
      ? Uint8Array.from(req.body.mintSecretKey as number[])
      : null;

    if (!user || !name || !symbol || !uri || !mintSecret || mintSecret.length !== 64) {
      res.status(400).json({ error: "Create transaction is missing wallet, name, ticker, or mint." });
      return;
    }
    if (!Number.isFinite(solBuy) || solBuy < 0) {
      res.status(400).json({ error: "Dev buy is invalid." });
      return;
    }

    const connection = new Connection(SOLANA_RPC, { commitment: "confirmed" });
    const userKey = new PublicKey(user);
    const balance = await connection.getBalance(userKey, "confirmed");
    const budget = pumpLaunchBudget(solBuy);
    if (balance / 1_000_000_000 + 1e-9 < budget.totalSol) {
      const haveSol = balance / 1_000_000_000;
      const maxBuy = maxPumpBuySol(balance);
      res.status(400).json({
        error:
          budget.buySol > 0 && maxBuy <= 0
            ? `Wallet has ${haveSol.toFixed(3)} SOL. Creating the token needs about ${budget.overheadSol.toFixed(3)} SOL for rent and fees before any buy. Add SOL or set the dev buy to 0.`
            : `Wallet has ${haveSol.toFixed(3)} SOL on-chain. A ${budget.buySol.toFixed(3)} SOL first buy plus create rent needs about ${budget.totalSol.toFixed(3)} SOL. Lower the dev buy to ${maxBuy.toFixed(3)} SOL or less.`,
      });
      return;
    }

    const mintKeypair = Keypair.fromSecretKey(mintSecret);
    const built = await buildMintSignedPumpCreateTx({
      connection,
      user: userKey,
      mintKeypair,
      name,
      symbol,
      uri,
      solBuy,
      mayhemMode,
    });

    res.json({
      transaction: Buffer.from(built.transaction.serialize()).toString("base64"),
      mint: mintKeypair.publicKey.toBase58(),
      blockhash: built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
      buyLamports: built.solLamports.toString(),
      buyTokens: built.tokenAmount.toString(),
      simulation: built.simulation,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Could not build the Pump.fun create transaction.",
    });
  }
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
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`OCG API listening on ${port}`);
  void ensureLaunchSchema()
    .then(() => startMarketCapPoller())
    .catch((error: unknown) => {
      console.error("Launch schema failed:", error);
    });
});
server.timeout = 180_000;
server.headersTimeout = 185_000;
server.requestTimeout = 180_000;

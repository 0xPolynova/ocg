# OCG — OnChainGame

Prompt a tiny playable game, inscribe it on Solana, and launch a Pump.fun token.

- Frontend: Next.js (`/launches`, `/create`)
- API server: Express on port 4000 (OpenRouter, Solana RPC proxy, Pump metadata)

Secrets stay on the API. The browser never sees `OPENROUTER_API_KEY` or `SOLANA_RPC`.

## Local

```bash
cp .env.example .env.local
# add OPENROUTER_API_KEY
npm install
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/health

## Render

1. Push this repo to GitHub.
2. In Render, **New → Blueprint** and select the repo (`render.yaml`).
3. Set API env vars: `OPENROUTER_API_KEY`, `SOLANA_RPC` (Helius or similar).
4. After the first API deploy, rebuild **ocg-web** if `NEXT_PUBLIC_API_URL` was empty at build time.

Wallet signing stays in the browser. Game generation, RPC, and IPFS uploads go through `ocg-api`.

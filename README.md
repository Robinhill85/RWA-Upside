# RWA-Upside

A **daily, self-updating dashboard** ranking low-market-cap **RWA / tokenization / stablecoin-yield**
tokens by upside potential — with progression over time and a Grok-written daily X/news brief.

Powered by the **[CoinMarketCap Skill Hub](https://coinmarketcap.com/api/skills-marketplace/)** +
**Grok (xAI)** + **CreatorCrawl**. Built for the **#CMCAgentHub** content competition.

> Research and education only. **Not financial advice.**

## How it works

```
cron (daily, fixed UTC)  →  scripts/snapshot.mjs
   • CMC Skill Hub (MCP): altcoin_token_profile, analyze_token_unlock_impact, altcoin_kol_sentiment
   • CreatorCrawl: real tweets + engagement (IDs/URLs)
   • Grok: daily brief + theme-fit & bullish scores, grounded on the fetched tweets
   • score across the cohort (lib/score.mjs) → rank
   →  writes data/snapshots/<YYYY-MM-DD>.json  →  git commit + push
                                                     →  Vercel rebuild → live page (app/)
```

The **snapshot job is a plain deterministic script — no LLM agent in the loop**, so it's cheap and
reliable to run on cron. The browser never sees a secret; the Next app only reads committed JSON.

## Setup

```bash
npm install
cp .env.example .env   # fill in CMC, Grok, CreatorCrawl keys  (.env is git-ignored)
npm run resolve        # validate watchlist slugs against CMC, fix any ✗
npm run snapshot       # produce today's snapshot (hits live APIs)
npm run dev            # view the dashboard locally
```

## Daily cron (Hermes / VPS)

Lowest-friction: a single daily command. Either let Hermes own it, or a system crontab:

```cron
# 00:00 UTC daily — snapshot, then commit+push so Vercel redeploys
0 0 * * *  cd /path/to/RWA-Upside && npm run snapshot && git add data/snapshots && git commit -m "snapshot $(date -u +\%F)" && git push
```

## Deploy (Vercel)

Import the repo, framework **Next.js**, root = repo root. No env vars needed in Vercel (it only
renders committed snapshots — all keys live on the VPS cron). Each snapshot push triggers a rebuild.

## Config

- `watchlist.json` — the fixed cohort (10 tokens). Always slug/cmcid, never bare symbol.
- `scripts/lib/score.mjs` — the scoring rubric + weights (see below). Defined up front; not tuned to favor any token.

### Scoring weights

**Market cap is a GATE (≤ $30M), not a linear factor.** Inside the band a $1M coin is not
meaningfully better than a $10M or $20M coin — upside comes from the other factors. Above $30M a
token is ineligible (score capped). Market cap therefore carries only a tiny tilt.

| Factor | Direction | Weight |
|---|---|---|
| **Newsworthy / bullish momentum** | higher = better | 30 |
| **Theme fit** (AI-ready · agentic · yield · stablecoin · RWA · tokenization) | higher = better | 28 |
| **Fully unlocked** | no dilution overhang = better | 22 |
| Social momentum | higher = better | 10 |
| Holder distribution | lower top-10 % = better | 6 |
| Market cap | gate ≤ $30M; gentle tilt only | 4 |

## Integration points to smoke-test on first run

- **CMC over MCP from Node** (`scripts/lib/cmc.mjs`) — uses `@modelcontextprotocol/sdk` Streamable HTTP transport.
- **CreatorCrawl REST path** (`scripts/lib/creatorcrawl.mjs`) — verify endpoint/shape against their docs; wrapper is shape-tolerant.
- **Grok model id** (`GROK_MODEL`, default `grok-4`) — adjust if your account exposes a different id.
- Metric extraction parses CMC analyst prose; raw responses are stored in `data/raw/` (git-ignored) for re-derivation.

## Security

Secrets live only in `.env` (git-ignored). The public repo ships `.env.example` placeholders.
Never commit `.env`.

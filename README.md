# RWA-Upside

**Live daily dashboard → [rwa-upside.vercel.app](https://rwa-upside.vercel.app)**

A self-updating ranking of low-market-cap **RWA / tokenization / stablecoin-yield** tokens by
upside potential — with day-over-day progression, a Grok-written brief per token, and the latest
on-chain-relevant tweet.

Powered by the **[CoinMarketCap Skill Hub](https://coinmarketcap.com/api/skills-marketplace/)** +
**Grok (xAI)** + **Apify** (live X) + **CoinGecko** (market-cap fallback). Built for the
**#CMCAgentHub** content competition.

> Research and education only. **Not financial advice.**

## How it works

```
cron (daily, 00:00 UTC)  →  scripts/snapshot.mjs   (deterministic, no LLM in the loop)
   • CMC Skill Hub (MCP):  altcoin_token_profile, analyze_token_unlock_impact, altcoin_kol_sentiment
   • Apify (live X):       latest tweets + engagement per project handle
   • CoinGecko:            market-cap fallback when CMC has none
   • Grok (xAI):           one-line brief, theme-fit & bullish scores, + figure extraction
                           (mcap / FDV / unlock) — grounded on the fetched data
   • score across the cohort (lib/score.mjs) → rank
   →  writes data/snapshots/<YYYY-MM-DD>.json  →  git commit + push
                                                     →  Vercel rebuild → live page (app/)
```

The snapshot job is a plain deterministic script — **no LLM agent in the loop** — so it's cheap and
reliable on cron. The browser never sees a secret; the Next.js app only reads committed JSON.

## Scoring

**Market cap is a GATE (≤ $50M), not a linear factor.** Inside the band, a $1M coin isn't treated as
meaningfully better than a $20M coin — upside comes from the other factors. Above $50M → ineligible.

**Liveness gate** — abandoned projects are pushed out of the ranking when any of:
- market cap has **collapsed** (`$0 < cap < $250k`), or
- **no tweet in > 75 days** (project gone silent), or
- Grok flags **`project_status: discontinued`**.

| Factor | Direction | Weight |
|---|---|---|
| Newsworthy / bullish momentum | higher = better | 30 |
| Theme fit (AI-ready · agentic · yield · stablecoin · RWA · tokenization) | higher = better | 28 |
| Fully unlocked | no dilution overhang | 22 |
| Social momentum | higher = better | 10 |
| Holder distribution | lower top-10 % = better | 6 |
| Market cap | gate ≤ $50M; gentle tilt only | 4 |

The rubric is fixed up front and applied to every token equally — no token is given a thumb on the scale.

## Setup

```bash
npm install
cp .env.example .env   # fill in CMC, Grok, Apify keys  (.env is git-ignored; CoinGecko is keyless)
npm run resolve        # validate watchlist slugs against CMC
npm run snapshot       # produce today's snapshot (hits live APIs)
npm run dev            # view the dashboard locally
```

## Daily cron (any always-on box)

```cron
0 0 * * *  cd /path/to/RWA-Upside && git pull --rebase --autostash && npm run snapshot \
           && git add data/snapshots && git commit -m "snapshot $(date -u +\%F)" && git push
```

A `cron-snapshot.sh` wrapper that does exactly this (with PATH set) is the recommended entry point.

## Deploy (Vercel)

Import the repo, framework **Next.js**, root = repo root. **No env vars needed in Vercel** — the page
only renders committed snapshots; all keys live on the cron box. Each snapshot push triggers a rebuild.

## Config

- `watchlist.json` — the fixed 10-token cohort (always slug/cmcid + `coingecko_id`, never bare symbol).
- `scripts/lib/score.mjs` — the scoring rubric + weights.

## Security

Secrets live only in `.env` (git-ignored). The repo ships `.env.example` placeholders. Never commit `.env`.

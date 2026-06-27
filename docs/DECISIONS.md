# Decisions (as-built)

This is the current architecture. For the original design doc see `SPEC.md` (kept for history).

1. **Public board, no client disclosure.** Focus is purely low-mcap, high-upside RWA coins; every
   token is ranked on merit. A generic "not financial advice" line stays on-page as standard prudence.

2. **Cohort = 10 tokens** (`watchlist.json`), referenced by slug/cmcid + `coingecko_id` — never bare symbol.

3. **Runs autonomously, daily.** The snapshot is a **deterministic script (no LLM in the loop)** invoked
   by cron once a day. CMC is reached via the MCP SDK; Grok, Apify, and CoinGecko via REST.

4. **Repo:** `RWA-Upside` (public). **Vercel project:** `rwa-upside`.

5. **Scoring rubric.**
   - **Market cap is a GATE (≤ $50M), not linear** — above = ineligible (score capped); within the band
     only a tiny tilt (weight 4). A $1M coin is not treated as much better than a $20M coin.
   - **Liveness gate** — excluded if cap collapsed (`$0 < cap < $250k`), no tweet in > 75 days, or Grok
     marks `discontinued`.
   - Weights: newsworthy/bullish **30**, theme-fit/AI **28**, fully-unlocked **22**, social 10,
     holders 6, market cap 4. (Full table in `README.md` / `scripts/lib/score.mjs`.)

## Data sources (and why)

- **Tweets → Apify** (`apidojo/tweet-scraper`, paid). The original plan used CreatorCrawl, but its
  backend (shared with "SocialCrawl") served months-stale cache for some handles — so it was dropped
  in favour of Apify's live X data, which fixed both bullishness accuracy and the recency liveness gate.
- **Market cap → CMC first, CoinGecko fallback.** CMC's analyst prose doesn't always expose a clean
  cap; CoinGecko (`coins/markets`, then FDV) fills the gap so the $50M gate always applies.
- **Grok extracts figures** (mcap / FDV / unlock / top-10) from CMC prose — robust to its
  non-deterministic wording — and writes the brief + theme/bullish scores.

## Notes

- xAI **Live Search** (`search_parameters`) is deprecated; Grok's `project_status` uses model knowledge,
  with the collapsed-cap + tweet-recency signals doing the heavy lifting for liveness.
- Tweet recency is reliable only because Apify is live; do **not** revert to a cached tweet source.

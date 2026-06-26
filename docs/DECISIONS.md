# Decisions (locked Jun 26 2026)

Answers to SPEC §14, as decided by Robin:

1. **Public board, no client disclosure.** Focus is purely low-mcap, high-upside RWA coins.
   IXS may or may not appear — it's just one candidate, ranked on merit. (A generic
   "not financial advice" line is kept on-page as standard prudence, separate from any
   client relationship.)

2. **Cohort size = 10** (was 8). See `watchlist.json`. Slugs/handles seeded but `verified:false`
   until `npm run resolve` confirms them.

3. **Hermes runs it autonomously, daily.** Lowest-friction path chosen: the snapshot is a
   **deterministic script (no LLM in the loop)** that Hermes (or a system crontab) invokes once
   a day. Cheaper and more reliable than driving an agent; CMC is reached via the MCP SDK,
   Grok + CreatorCrawl via REST.

4. **Repo:** `RWA-Upside` (public). **Vercel project:** `rwa-upside`.

5. **Scoring — two new factors added** (per Robin):
   - **Theme fit** — alignment with hot trends (AI/agentic, yield, stablecoin, RWA, tokenization), weight 18.
   - **Newsworthy / bullish momentum** — recent bullish catalysts/news, weight 19 (absorbs the old "catalyst" factor).
   Both are produced by Grok (`theme_fit_score`, `bullish_score`) grounded on fetched tweets.
   Full weight table in `README.md` / `scripts/lib/score.mjs`.

## Still open / to confirm on first run

- Verify the 10 slugs (`npm run resolve`) and confirm the X handles.
- Confirm Grok + CreatorCrawl keys work from the VPS; confirm CreatorCrawl REST endpoint shape.
- Smoke-test the CMC-over-MCP transport from Node.
- Decide hero-tweet embedding (P2) vs snapshot cards once tweets are flowing.

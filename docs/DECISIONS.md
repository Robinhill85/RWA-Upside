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

5. **Scoring rubric — v2 (revised Jun 26 after first live run):**
   - **Market cap is a GATE, not linear.** ≤ $30M to qualify; above = ineligible (score capped at 20).
     Within the band, market cap carries only a tiny tilt (weight 4) — a $1M coin is NOT treated as
     much better than a $10M/$20M coin. Upside comes from the other factors.
   - **Newsworthy / bullish momentum** weight **30** (valued most).
   - **Theme fit / AI-ready** (AI/agentic, yield, stablecoin, RWA, tokenization) weight **28**.
   - **Fully unlocked** weight **22** — and now extracted reliably via Grok (grounded on CMC prose),
     not brittle regex, since it's weighted heavily.
   - Social momentum 10, holder distribution 6.
   Theme/bullish/extraction all produced by Grok. Full table in `README.md` / `scripts/lib/score.mjs`.

## Still open / to confirm on first run

- Verify the 10 slugs (`npm run resolve`) and confirm the X handles.
- Confirm Grok + CreatorCrawl keys work from the VPS; confirm CreatorCrawl REST endpoint shape.
- Smoke-test the CMC-over-MCP transport from Node.
- Decide hero-tweet embedding (P2) vs snapshot cards once tweets are flowing.

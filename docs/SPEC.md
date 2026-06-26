# CMC RWA Radar — Live Low-Cap RWA Dashboard

**A self-updating, progression-tracking dashboard of low-market-cap RWA / tokenization /
stablecoin-yield tokens, powered by the CoinMarketCap Skill Hub + Grok + CreatorCrawl.**
Built as an entry for the CMC Agent Hub content competition.

---

## 1. Goal & context

- **What:** A public web page that ranks a small universe of low-cap RWA tokens daily, shows
  each token's progression over time (score, market cap, rank, holders, sentiment), and a
  daily X/news brief with embedded tweets per project.
- **Why:** Stronger, more original CMC Agent Hub entry than a static infographic — a *living*
  artifact that demonstrably runs CMC skills every day.
- **Competition window:** Entries **Jun 16 – Jul 6 2026**; winners **Jul 13 2026**.
  Today is Jun 26 → start the cron immediately to bank ~10 days of history by deadline.
- **Posture:** Research/education only. NOT financial advice. (See §12 — IXS is a client.)

## 2. Competition compliance checklist

- [ ] Name + link the skill(s) used on the Marketplace
      (`coinmarketcap.com/api/skills-marketplace/?skill=<skill_you_used>`)
- [ ] Tag `@coinmarketcap`
- [ ] Use `#CMCAgentHub`
- [ ] Include a screenshot / live demo of real output (the dashboard *is* the demo)
- [ ] Name the skill(s) used on the page itself
- [ ] Original content
- [ ] (Note: built in Claude Code, not the Claude chat app — per competition note)

## 3. Architecture

```
                        ┌──────────────── Hermes agent on VPS (cron, daily 00:00 UTC) ────────────────┐
                        │                                                                              │
   CMC Skill Hub  ◀─────┤  1. For each token in watchlist:                                             │
   (MCP, HTTP)          │       • altcoin_token_profile        → mcap, FDV, holders, liquidity, TVL    │
                        │       • analyze_token_unlock_impact   → forward dilution                      │
                        │       • altcoin_kol_sentiment         → social sentiment score                │
   CreatorCrawl  ◀──────┤       • get_twitter_user_tweets       → real tweets + engagement + IDs        │
   (tweets)             │  2. Feed fetched tweets → Grok API    → structured daily brief + sentiment    │
   Grok / xAI    ◀──────┤  3. Compute upside score (fixed rubric)                                       │
                        │  4. Write ONE immutable snapshot JSON: data/snapshots/<YYYY-MM-DD>.json       │
                        │  5. git commit + push                                                         │
                        └──────────────────────────────────┬───────────────────────────────────────────┘
                                                            │ push triggers
                                                            ▼
                                              Vercel (Next.js) rebuild / ISR
                                                            │
                                                            ▼
                          Live page: daily top-5 leaderboard + per-token progression charts
                                     + embedded "hero" tweet + snapshot tweet cards + Grok brief
```

**Principle:** the browser never touches a secret. All keyed calls happen in the VPS cron.
The web app only reads committed snapshot JSON.

## 4. Data sources (per daily run)

| Source | Access | Role | Per-run calls |
|---|---|---|---|
| CMC Skill Hub | MCP (Streamable HTTP) | Metrics, unlocks, sentiment score | 3 skills × N tokens |
| CreatorCrawl | MCP / API | Real tweets + IDs + engagement | 1 × N handles |
| Grok (xAI) | REST API | Daily brief + grounded sentiment over fetched tweets | 1 × N tokens (or 1 batched) |
| Apify (backup) | `APIFY_TOKEN` | Tweet fetch fallback if CreatorCrawl fails | on-demand |
| Bright Data (deep backup) | bearer | Anti-bot fallback | rare |

N = watchlist size (start with ~8). Keep N small → predictable cost.

## 5. Data model

### `watchlist.json` (hand-maintained, the fixed cohort)
```jsonc
{
  "tokens": [
    {
      "slug": "ix-swap",        // CMC slug — ALWAYS slug/cmcid, never bare symbol
      "cmcid": null,            // fill once resolved, preferred for stability
      "symbol": "IXS",
      "name": "IX Swap",
      "x_handle": "IXSwap",     // TO VERIFY — needed for tweet fetch + embeds
      "is_client": true,        // drives the disclosure badge
      "added": "2026-06-26"
    }
    // … ~7 more sub-$50M RWA / tokenization / stablecoin-yield names
  ]
}
```

### `data/snapshots/<YYYY-MM-DD>.json` (immutable, one per day)
```jsonc
{
  "date": "2026-06-26",
  "generated_at_utc": "2026-06-26T00:00:12Z",
  "skills_used": ["altcoin_token_profile","analyze_token_unlock_impact","altcoin_kol_sentiment"],
  "tokens": [
    {
      "slug": "ix-swap",
      "rank_today": 1,
      "metrics": {
        "price_usd": 0.0547,
        "market_cap_usd": 9850000,
        "fdv_usd": 9850000,
        "fully_unlocked": true,            // fdv ≈ mcap AND no forward unlocks
        "forward_unlock_state": "schedule_visibility_limited",
        "holders_total": 7345,
        "top10_holder_pct": 23.92,
        "vol_24h_usd": 67100,
        "vol_to_mcap_pct": 0.68,
        "tvl_usd": 113400,
        "price_change": { "24h": 1.35, "7d": -8.51, "30d": -26.13, "90d": -18.28 }
      },
      "sentiment": { "score": null, "fresh_chatter": null, "kol_stance": null },
      "social": {
        "tweets": [
          { "id": "...", "url": "https://x.com/IXSwap/status/...",
            "text": "...", "likes": 0, "retweets": 0, "posted_at": "..." }
        ],
        "hero_tweet_id": "..."           // highest-engagement official post in last 24h
      },
      "grok_brief": {
        "one_line": "...",
        "key_events": ["..."],
        "post_count_24h": 0,
        "sentiment_score": 0.0
      },
      "upside_score": 0.0,                 // from §6 rubric
      "score_breakdown": { "mcap": 0, "unlock": 0, "holders": 0, "catalyst": 0, "sentiment": 0, "liquidity_risk": 0 }
    }
  ],
  "data_gaps": ["..."]                     // anything a skill returned blocked/partial
}
```

## 6. Scoring rubric (FIXED — define before looking at data; do not tune to favor a token)

| Factor | Direction | Weight | Source |
|---|---|---|---|
| Market cap | lower = better (more room) | 25% | profile |
| Unlock cleanliness | fully unlocked / no forward unlocks = better | 25% | profile + unlock |
| Holder distribution | lower top-10 % = better | 15% | profile |
| Catalyst | live product / buyback-burn / partnership = better | 15% | Grok + official_dynamics |
| Social momentum | KOL constructive / fresh chatter = better | 10% | kol_sentiment + Grok |
| Liquidity | scored as RISK (penalty), not upside | 10% | profile (vol/mcap) |

- Normalize each factor 0–1 across the cohort, apply weights, sum → `upside_score`.
- **Anti-bias rule:** IXS is included as a *benchmark to beat*. If it is not #1 on the fair
  rubric, the page says so. Never reweight to force a winner.

## 7. Cohort vs ranking (the churn fix)

- **Fixed watchlist** (everything that has *ever* entered the top 5, incl. IXS) → continuous,
  unbroken time-series for charts.
- **Daily top-5 ranking** computed on top of the watchlist → the live leaderboard.
- This avoids broken sparklines when a coin drops out and re-enters.

## 8. Cron job (Hermes / VPS)

- **Schedule:** daily, **00:00 UTC** fixed (clean day-over-day deltas).
- **Idempotent:** one snapshot per date; if today's file exists, overwrite only on explicit
  re-run flag; retry transient failures with backoff.
- **Store raw skill JSON** alongside the computed snapshot → lets you recompute the score
  formula later without re-fetching history.
- **Steps:** resolve identities (slug/cmcid) → fan out CMC skills (parallel) → fetch tweets →
  Grok brief over fetched tweets → compute scores → write snapshot → commit + push.
- **Backfill note:** historical series CANNOT be reconstructed except price (7d/30d/90d deltas
  come from the profile skill). Score / rank / holders / sentiment series start day 1.

## 9. Frontend (Vercel / Next.js)

- **Stack:** Next.js (App Router) + Tailwind + a light chart lib (Recharts/visx). ISR or
  rebuild-on-push reading from committed JSON.
- **Pages/sections:**
  - **Leaderboard** — today's top 5: token, mcap, unlock badge, score, Δ vs last week, Δ vs yesterday.
  - **Per-token detail** — progression charts (score, mcap, rank, holders, sentiment),
    hero tweet embed + snapshot tweet cards, Grok brief, data-gap notes.
  - **Methodology** — the rubric, the skills used (named + linked to Marketplace), disclaimers.
  - **Status bar** — "last updated", "next update", snapshot count, days to deadline.
- **Trust elements:** last-updated timestamp, skill names + Marketplace links, `#CMCAgentHub`,
  `@coinmarketcap`, research-only + client-disclosure banner.

## 10. Tweet display

- **Retrieval:** CreatorCrawl `get_twitter_user_tweets` (Apify fallback) → real IDs/URLs/metrics.
  Do NOT rely on Grok for tweet IDs (it paraphrases).
- **Hero tweet (1 per project):** official X embed via `platform.twitter.com/widgets.js`
  (authentic look).
- **Rest:** self-styled snapshot cards from stored tweet data (fast, on-brand, frozen-in-time =
  consistent with progression model, survives deletion).
- **Curation rule:** highest-engagement official post in last 24h, or the post Grok flags as the
  day's key catalyst. One hero per project — no walls of tweets.

## 11. API keys / secrets inventory

| Service | Needed for | Status |
|---|---|---|
| **CMC Skill Hub** | All market/unlock/sentiment skills | ✅ HAVE — installed, key set (user config) |
| **Grok / xAI** | Daily brief + grounded sentiment | ⚠️ CONFIRM — already used by Hermes/Grok (Atlantis); verify same key is reusable here + billing/rate limit headroom |
| **CreatorCrawl** | Real tweets + IDs + engagement | ⚠️ CONFIRM — connected as MCP; need standalone API key (or run via MCP from Hermes) on the VPS |
| **Apify** (`APIFY_TOKEN`) | Tweet fetch fallback | ✅ HAVE |
| **Bright Data** (Web Unlocker) | Anti-bot deep fallback | ✅ HAVE |
| **Vercel** | Hosting + rebuild-on-push | ✅ HAVE |
| **Anthropic** (if Claude Code is the VPS runtime) | Driving the agent on cron | ✅ HAVE (see key map) |
| **GitHub repo / deploy token** | Cron commits → Vercel trigger | ⚠️ CONFIRM — create the repo + push creds on the VPS |

**Net: no genuinely missing third-party key.** Two to *confirm access on the VPS*
(Grok key reuse, CreatorCrawl standalone key) and one housekeeping item (repo + push creds).

## 12. Risks, caveats, disclosures

- **Conflict of interest:** IXS is a client. Either (a) show a clear disclosure badge + keep the
  rubric honest, or (b) make the *public* hero version run a neutral skill
  (`daily_market_overview`) and keep the RWA-ranking private. Decision needed.
- **Research, not advice:** persistent banner; the CMC skills themselves stamp this.
- **Backfill limit:** "since last week" only fully populates after 7 running days (price aside).
- **Data gaps:** skills return `partial`/`blocked` (e.g. fees/revenue lanes, unlock visibility).
  Render gaps explicitly — never impute.
- **Rate limits / cost:** keep N small; batch Grok where possible; store raw JSON to avoid re-fetch.
- **Tweet/ToS:** official embed widget is the safe display path; deleted tweets break embeds
  (snapshot cards persist).

## 13. Build phases (shipped-then-iterate)

- **P0 — Skeleton (day 1):** watchlist (8 names, handles verified) + cron runs CMC skills only →
  snapshot JSON → Next.js leaderboard reading it. Ship to Vercel. *Banks history immediately.*
- **P1 — Progression:** charts from accumulated snapshots; Δ-vs-yesterday; status bar.
- **P2 — Social:** CreatorCrawl tweets + hero embed + snapshot cards.
- **P3 — Grok brief:** structured daily brief + sentiment, grounded on fetched tweets.
- **P4 — Polish + compliance:** methodology page, skill Marketplace links, disclosures, share image.

## 14. Open decisions for Robin

1. Public ranking includes IXS (with disclosure) **or** neutral public skill + private RWA board?
2. Final watchlist — confirm the ~8 slugs + verified `@handle`s.
3. Hermes runtime: does it call MCP directly, or shell out to headless Claude Code on the VPS?
4. Repo location + Vercel project name.
5. Score weights in §6 — accept as-is or adjust (before any data is seen).

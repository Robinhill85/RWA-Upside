# Deploy & automate

Two parts: **(A) Vercel** hosts the page, **(B) Hermes cron** on the VPS produces the daily
snapshot and pushes it, which auto-triggers a Vercel rebuild.

```
Hermes VPS (daily 00:00 UTC): npm run snapshot → git commit+push → Vercel rebuild → live page
```

## A. Vercel (no API key needed)

**Recommended — dashboard import (wires auto-deploy on push):**
1. vercel.com → Add New → Project → Import `Robinhill85/RWA-Upside`.
2. Framework: **Next.js** (auto-detected). Root: repo root. Build: default.
3. **No environment variables needed** — the page only reads committed snapshot JSON; all secrets live on the VPS.
4. Deploy. Name the project **rwa-upside**.

Every future `git push` (including the cron's snapshot commits) now redeploys automatically.

**Alternative — CLI from a trusted machine** (needs a Vercel token, doesn't set up auto-deploy):
```bash
vercel link && vercel --prod
```

## B. Hermes cron on the VPS

**One-time setup:**
```bash
git clone https://github.com/Robinhill85/RWA-Upside.git
cd RWA-Upside
npm install
cp .env.example .env        # then fill in the real keys (same values as local .env)
npm run snapshot            # smoke-test one run
```

`.env` needs: `CMC_MCP_API_KEY`, `GROK_API_KEY`, `CREATORCRAWL_API_KEY` (CoinGecko works keyless).

**GitHub push credential** (so the cron can push snapshots) — the one new secret required.
Use a fine-grained PAT with `contents:write` on this repo, then:
```bash
git remote set-url origin https://<PAT>@github.com/Robinhill85/RWA-Upside.git
git config user.email "bot@rwa-upside" && git config user.name "rwa-upside-bot"
```

**Crontab** (`crontab -e`) — daily at 00:00 UTC:
```cron
0 0 * * *  cd /path/to/RWA-Upside && /usr/bin/npm run snapshot && git add data/snapshots && git commit -m "snapshot $(date -u +\%F)" && git push >> /var/log/rwa-upside.log 2>&1
```

Notes:
- Ensure the box runs in UTC (or adjust the cron hour) so snapshot dates line up.
- `data/raw/` is git-ignored (raw API payloads); only `data/snapshots/` is committed.
- The job is a plain deterministic script — **no LLM agent in the loop** — so it's cheap and stable.

## Verify after deploy
- Vercel URL shows the latest leaderboard with a fresh "Last updated" timestamp.
- After the first cron run, a new `data/snapshots/<date>.json` appears on GitHub and the Vercel
  deployment list shows a build triggered by that commit.

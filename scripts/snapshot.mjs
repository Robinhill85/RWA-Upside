// Daily snapshot job — run by cron (Hermes-owned or system crontab) at a fixed UTC time.
// Deterministic: no LLM agent in the loop. Produces ONE immutable snapshot per day.
//
//   node --env-file=.env scripts/snapshot.mjs
//
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { connectCmc, tokenProfile, unlockImpact, kolSentiment } from "./lib/cmc.mjs";
import { fetchTweets, pickHero } from "./lib/creatorcrawl.mjs";
import { grokBrief } from "./lib/grok.mjs";
import { scoreCohort } from "./lib/score.mjs";

const ROOT = path.resolve(process.cwd());
const CONC = Number(process.env.SNAPSHOT_CONCURRENCY || 3);
const today = new Date().toISOString().slice(0, 10);

// ---- tiny defensive extractors (CMC skills return analyst prose + partial structured fields) ----
function deepFind(obj, keys, type = "number") {
  let hit;
  const want = new Set(keys);
  (function walk(o) {
    if (hit !== undefined || o == null) return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (want.has(k) && typeof v === type) { hit = v; return; }
        walk(v);
      }
    }
  })(obj);
  return hit;
}
function collectProse(obj) {
  const out = [];
  (function walk(o) {
    if (o == null) return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string" && /analysis|conclusion|summary/i.test(k)) out.push(v);
        else walk(v);
      }
    }
  })(obj);
  return out.join(" \n ");
}
function extractMetrics(profile, unlock) {
  const blob = { profile, unlock };
  const market_cap_usd = deepFind(blob, ["market_cap_usd", "marketCap"]);
  const price_usd = deepFind(blob, ["price_usd"]);
  const vol_24h_usd = deepFind(blob, ["volume_24h_usd", "vol_24h_usd"]);
  const prose = collectProse(blob);
  const top10 = prose.match(/top[\s-]?10[^%]*?([\d.]+)\s*%/i);
  const fully_unlocked =
    /full circulating supply|fully unlocked|fdv\s*(?:equals|=|≈|sits at|of)?[^.]{0,40}(?:equal|=|≈)\s*(?:current\s*)?market cap|fully diluted valuation equals current market cap/i.test(
      prose
    );
  return {
    price_usd: price_usd ?? null,
    market_cap_usd: market_cap_usd ?? null,
    fdv_usd: deepFind(blob, ["fdv_usd"]) ?? null,
    fully_unlocked,
    forward_unlock_state: deepFind(blob, ["sell_pressure_state"], "string") ?? "unknown",
    top10_holder_pct: top10 ? Number(top10[1]) : null,
    vol_24h_usd: vol_24h_usd ?? null,
    vol_to_mcap_pct:
      vol_24h_usd && market_cap_usd ? round((vol_24h_usd / market_cap_usd) * 100, 2) : null,
  };
}
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

async function gather(client, token) {
  const gaps = [];
  const safe = async (label, p) => {
    try { return await p; } catch (e) { gaps.push(`${token.slug}:${label}: ${e.message}`); return null; }
  };
  const [profile, unlock, sentiment, tweets] = await Promise.all([
    safe("profile", tokenProfile(client, token)),
    safe("unlock", unlockImpact(client, token.slug)),
    safe("sentiment", kolSentiment(client, token)),
    safe("tweets", fetchTweets(token.x_handle)),
  ]);
  const grok = await safe("grok", grokBrief({ token, tweets: tweets || [] }));
  const metrics = extractMetrics(profile, unlock);
  return {
    slug: token.slug,
    symbol: token.symbol,
    name: token.name,
    x_handle: token.x_handle,
    themes: token.themes,
    metrics,
    sentiment: { score: deepFind({ sentiment }, ["sentiment_score"]) ?? grok?.sentiment_score ?? null },
    social: { tweets: tweets || [], hero_tweet_id: pickHero(tweets || []) },
    grok_brief: grok || {},
    _raw: { profile, unlock, sentiment }, // for re-derivation; written to data/raw (gitignored)
    gaps,
  };
}

async function main() {
  const watchlist = JSON.parse(await readFile(path.join(ROOT, "watchlist.json"), "utf8"));
  const tokens = watchlist.tokens;
  console.log(`[snapshot] ${today} — ${tokens.length} tokens, concurrency ${CONC}`);

  const client = await connectCmc();
  let rows;
  try {
    rows = await pool(tokens, CONC, (t) => gather(client, t));
  } finally {
    await client.close?.();
  }

  // score across the cohort, then rank
  const scores = scoreCohort(rows);
  rows.forEach((r, i) => Object.assign(r, scores[i]));
  const ranked = [...rows].sort((a, b) => b.upside_score - a.upside_score);
  ranked.forEach((r, i) => (r.rank_today = i + 1));

  const allGaps = rows.flatMap((r) => r.gaps);
  const snapshot = {
    date: today,
    generated_at_utc: new Date().toISOString(),
    skills_used: ["altcoin_token_profile", "analyze_token_unlock_impact", "altcoin_kol_sentiment"],
    tokens: rows.map(({ _raw, gaps, ...keep }) => keep),
    data_gaps: allGaps,
  };

  await mkdir(path.join(ROOT, "data/snapshots"), { recursive: true });
  await writeFile(
    path.join(ROOT, "data/snapshots", `${today}.json`),
    JSON.stringify(snapshot, null, 2)
  );
  // raw responses (gitignored) for later re-scoring without re-fetching
  await mkdir(path.join(ROOT, "data/raw"), { recursive: true });
  await writeFile(
    path.join(ROOT, "data/raw", `${today}.json`),
    JSON.stringify(rows.map((r) => ({ slug: r.slug, raw: r._raw })), null, 2)
  );

  console.log(
    `[snapshot] wrote ${today}.json — top: ${ranked.slice(0, 3).map((r) => `${r.symbol}(${r.upside_score})`).join(", ")}`
  );
  if (allGaps.length) console.warn(`[snapshot] ${allGaps.length} data gap(s):\n - ${allGaps.join("\n - ")}`);
}

main().catch((e) => {
  console.error("[snapshot] FAILED:", e);
  process.exit(1);
});

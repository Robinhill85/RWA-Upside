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
    if (typeof o === "string") {
      // some skills nest their structured payload inside a JSON string (e.g. result.output)
      const s = o.trim();
      if (s[0] === "{" || s[0] === "[") { try { walk(JSON.parse(s)); } catch {} }
      return;
    }
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
function parseMoney(str, label) {
  const m = str.match(new RegExp(label + "[^$]{0,60}\\$([\\d.,]+)\\s*([KMB])?", "i"));
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  const u = (m[2] || "").toUpperCase();
  const val = n * (u === "B" ? 1e9 : u === "M" ? 1e6 : u === "K" ? 1e3 : 1);
  // reject stray small numbers (prices, holder counts) when no magnitude unit is present
  if (!u && val < 100000) return null;
  return val;
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
const numOr = (v) => (Number.isFinite(v) ? v : null);

// Grok-extracted figures are preferred (robust to non-deterministic CMC prose); regex is fallback.
function extractMetrics(profile, unlock, grok = {}) {
  const blob = { profile, unlock };
  const prose = collectProse(blob);
  let market_cap_usd =
    numOr(grok.market_cap_usd) ??
    deepFind(blob, ["market_cap_usd", "marketCap"]) ??
    parseMoney(prose, "market cap");
  // sanity floor: sub-$50k "caps" are almost always a misread (price, TVL, holder count) → unknown
  if (Number.isFinite(market_cap_usd) && market_cap_usd < 50000) market_cap_usd = null;
  const fdv_usd =
    numOr(grok.fdv_usd) ??
    deepFind(blob, ["fdv_usd"]) ??
    parseMoney(prose, "fully diluted valuation");
  const price_usd = deepFind(blob, ["price_usd"]) ?? parseMoney(prose, "price");
  const vol_24h_usd = deepFind(blob, ["volume_24h_usd", "vol_24h_usd"]);
  const top10re = prose.match(/top[\s-]?10[^%]*?([\d.]+)\s*%/i);
  const top10_holder_pct = numOr(grok.top10_holder_pct) ?? (top10re ? Number(top10re[1]) : null);
  const fully_unlocked =
    typeof grok.fully_unlocked === "boolean"
      ? grok.fully_unlocked
      : /full circulating supply|fully unlocked|fully diluted valuation equals current market cap/i.test(prose) ||
        (Number.isFinite(market_cap_usd) &&
          Number.isFinite(fdv_usd) &&
          fdv_usd > 0 &&
          market_cap_usd / fdv_usd >= 0.98);
  return {
    price_usd: price_usd ?? null,
    market_cap_usd: market_cap_usd ?? null,
    fdv_usd: fdv_usd ?? null,
    fully_unlocked,
    forward_unlock_state: deepFind(blob, ["sell_pressure_state"], "string") ?? "unknown",
    top10_holder_pct,
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
  // Tweets (CreatorCrawl) can run in parallel, but serialize the CMC/MCP calls —
  // the skill-hub times out under many concurrent requests.
  const tweetsP = safe("tweets", fetchTweets(token.x_handle));
  const profile = await safe("profile", tokenProfile(client, token));
  const unlock = await safe("unlock", unlockImpact(client, token.slug));
  const sentiment = await safe("sentiment", kolSentiment(client, token));
  const tweets = await tweetsP;
  const cmcProse = collectProse({ profile, unlock });
  const grok = await safe("grok", grokBrief({ token, tweets: tweets || [], cmcProse }));
  const metrics = extractMetrics(profile, unlock, grok || {});
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

// Fixed upside-scoring rubric — define BEFORE looking at data; do not tune to favor a token.
// Each factor is normalized 0..1 across the current cohort, then weighted. Sum of weights = 100.
//
// Factors (per Robin's decisions):
//   marketCap     lower = better (more room to run)
//   unlock        fully unlocked / no forward unlocks = better
//   holders       lower top-10 concentration = better
//   themeFit      AI/agentic + yield + stablecoin + RWA + tokenization alignment = better   [NEW]
//   newsworthy    bullish news / catalyst momentum = better                                  [NEW]
//   social        KOL constructive / fresh chatter = better
//   liquidity     scored as RISK — thin liquidity is a penalty, not upside

export const WEIGHTS = {
  marketCap: 18,
  unlock: 18,
  holders: 9,
  themeFit: 18, // NEW — hot-trend alignment
  newsworthy: 19, // NEW — bullish/newsworthy potential
  social: 10,
  liquidityRisk: 8, // penalty
};

// min-max normalize; invert=true means lower raw value → higher score
function norm(values, invert = false) {
  const nums = values.map((v) => (Number.isFinite(v) ? v : null));
  const present = nums.filter((v) => v !== null);
  if (!present.length) return nums.map(() => 0.5);
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  return nums.map((v) => {
    if (v === null) return 0.5; // neutral for missing data
    const s = (v - min) / span;
    return invert ? 1 - s : s;
  });
}

// rows: [{ metrics, sentiment, grok_brief }]  → returns scores aligned by index
export function scoreCohort(rows) {
  const mcap = norm(rows.map((r) => r.metrics?.market_cap_usd), true);
  const top10 = norm(rows.map((r) => r.metrics?.top10_holder_pct), true);
  const vol = norm(rows.map((r) => r.metrics?.vol_to_mcap_pct)); // higher liquidity = lower risk
  const themeFit = rows.map((r) => clamp01(r.grok_brief?.theme_fit_score));
  const news = rows.map((r) => clamp01(r.grok_brief?.bullish_score));
  const social = rows.map((r) =>
    clamp01(r.sentiment?.score ?? r.grok_brief?.sentiment_score)
  );
  const unlock = rows.map((r) => (r.metrics?.fully_unlocked ? 1 : 0.3));

  const W = WEIGHTS;
  const total =
    W.marketCap + W.unlock + W.holders + W.themeFit + W.newsworthy + W.social + W.liquidityRisk;

  return rows.map((_, i) => {
    const breakdown = {
      marketCap: mcap[i] * W.marketCap,
      unlock: unlock[i] * W.unlock,
      holders: top10[i] * W.holders,
      themeFit: themeFit[i] * W.themeFit,
      newsworthy: news[i] * W.newsworthy,
      social: social[i] * W.social,
      // liquidity risk: low liquidity (low vol[i]) costs points
      liquidityRisk: vol[i] * W.liquidityRisk,
    };
    const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return { upside_score: round(raw * (100 / total)), score_breakdown: roundAll(breakdown) };
  });
}

const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);
const round = (v) => Math.round(v * 10) / 10;
const roundAll = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));

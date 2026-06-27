// Upside-scoring rubric.
//
// Market cap is a GATE, not a linear factor: ≤ $50M to qualify. Inside the band a $1M coin is
// NOT meaningfully better than a $10M or $20M coin — potential comes from the OTHER factors.
// So market cap carries a tiny weight (gentle tilt only) and above the gate a token is ineligible.
// A second gate is LIVENESS: discontinued or long-silent projects are pushed out of the ranking.
//
// What actually drives upside (per Robin):
//   newsworthy/bullish  ── valued most
//   theme fit (AI-ready · agentic · yield · stablecoin · RWA · tokenization)
//   fully unlocked       ── no dilution overhang
//   then: social momentum, holder distribution, and a small market-cap tilt.

export const GATE_MCAP_USD = 50_000_000;

export const WEIGHTS = {
  newsworthy: 30, // bullish / newsworthy momentum
  themeFit: 28, // AI-ready / hot-trend alignment
  unlock: 22, // fully unlocked
  social: 10, // KOL / fresh chatter
  holders: 6, // distribution (lower top-10 % = better)
  marketCap: 4, // GATE first; within ≤$30M only a gentle tilt
};

const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);
const round = (v) => Math.round(v * 10) / 10;
const roundAll = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));

// Gentle within-band score: $1M ≈ 1.0, $30M ≈ 0.5 → at most a few points of spread.
function mcapBandScore(mcap) {
  if (!Number.isFinite(mcap)) return 0.7; // unknown → neutral-ish
  if (mcap > GATE_MCAP_USD) return 0; // over the gate
  return 1 - (mcap / GATE_MCAP_USD) * 0.5;
}
function holderScore(top10) {
  if (!Number.isFinite(top10)) return 0.5;
  return clamp01(1 - top10 / 100); // lower concentration = better
}
function unlockScore(light) {
  // green = fully circulating, yellow = ≤20% locked, red = >20% locked, unknown = neutral
  return light === "green" ? 1 : light === "yellow" ? 0.6 : light === "red" ? 0.2 : 0.5;
}

export function scoreCohort(rows) {
  const W = WEIGHTS;
  const total = Object.values(W).reduce((a, b) => a + b, 0);

  return rows.map((r) => {
    const mcap = r.metrics?.market_cap_usd;
    const eligible = !Number.isFinite(mcap) ? null : mcap <= GATE_MCAP_USD; // null = unknown

    const factors = {
      newsworthy: clamp01(r.grok_brief?.bullish_score),
      themeFit: clamp01(r.grok_brief?.theme_fit_score),
      unlock: unlockScore(r.metrics?.unlock_light),
      social: clamp01(r.sentiment?.score ?? r.grok_brief?.sentiment_score),
      holders: holderScore(r.metrics?.top10_holder_pct),
      marketCap: mcapBandScore(mcap),
    };
    const breakdown = Object.fromEntries(
      Object.entries(factors).map(([k, v]) => [k, v * W[k]])
    );
    let raw = Object.values(breakdown).reduce((a, b) => a + b, 0) * (100 / total);

    // hard gate: above the cap is not an eligible low-cap pick
    if (eligible === false) raw = Math.min(raw, 20);
    // liveness gate: discontinued / long-silent projects are pushed out of the ranking
    const active = r.liveness?.active !== false; // default active unless explicitly flagged
    if (!active) raw = Math.min(raw, 12);

    return { upside_score: round(raw), eligible, active, score_breakdown: roundAll(breakdown) };
  });
}

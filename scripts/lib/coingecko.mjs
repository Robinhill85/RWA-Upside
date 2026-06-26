// CoinGecko fallback for market cap when the CMC Skill Hub doesn't return one.
// Single batched call for the whole cohort; retries on free-tier throttling.

const BASE = process.env.COINGECKO_BASE_URL || "https://api.coingecko.com/api/v3";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ids: array of coingecko ids → returns Map<id, market_cap_usd>
export async function fetchMarketCaps(ids) {
  const out = new Map();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return out;

  const url = new URL(`${BASE}/coins/markets`);
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("ids", unique.join(","));
  url.searchParams.set("per_page", String(unique.length));

  const key = process.env.COINGECKO_API_KEY;
  const headers = key ? { "x-cg-demo-api-key": key } : {};

  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch(url, { headers });
    if (resp.status === 429 || resp.status === 403) {
      await sleep(3000 * (attempt + 1)); // back off on throttle
      continue;
    }
    if (!resp.ok) throw new Error(`CoinGecko ${resp.status}: ${(await resp.text()).slice(0, 120)}`);
    const text = await resp.text();
    if (text.trim().startsWith("Throttled")) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    for (const row of JSON.parse(text)) {
      if (row?.id && Number.isFinite(row.market_cap)) out.set(row.id, row.market_cap);
    }
    return out;
  }
  throw new Error("CoinGecko throttled after retries");
}

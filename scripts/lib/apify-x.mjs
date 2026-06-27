// Apify X/Twitter scraper (apidojo/tweet-scraper) — fresh, live tweet data.
// Replaces the CreatorCrawl/SocialCrawl backend, which served months-stale cache for some handles.
// One synchronous run per handle via run-sync-get-dataset-items.

const ACTOR = "apidojo~tweet-scraper";
const BASE = process.env.APIFY_BASE_URL || "https://api.apify.com/v2";

export async function fetchTweets(handle, { maxItems = 20 } = {}) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN missing in env");
  const url = `${BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`;
  const body = { startUrls: [`https://twitter.com/${handle}`], maxItems, sort: "Latest" };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Apify ${resp.status}: ${t.slice(0, 150)}`);
  }
  const rows = await resp.json();
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r && !r.noResults && (r.id || r.text)).map(normalize).filter(Boolean);
}

function normalize(t) {
  const id = t.id ? String(t.id) : null;
  let posted_at = t.createdAt || null;
  if (posted_at) {
    const d = new Date(posted_at); // "Sat Jun 27 06:01:43 +0000 2026" → ISO for reliable Date.parse
    if (!isNaN(d)) posted_at = d.toISOString();
  }
  const uname = t.author?.userName || t.author?.username;
  return {
    id,
    url: t.url || t.twitterUrl || (id && uname ? `https://x.com/${uname}/status/${id}` : null),
    text: t.fullText || t.text || "",
    likes: t.likeCount ?? 0,
    retweets: t.retweetCount ?? 0,
    posted_at,
  };
}

export function pickHero(tweets) {
  if (!tweets?.length) return null;
  return [...tweets].sort((a, b) => b.likes + b.retweets - (a.likes + a.retweets))[0]?.id ?? null;
}

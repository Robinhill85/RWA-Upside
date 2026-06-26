// CreatorCrawl — fetch real tweets (with IDs/URLs/engagement) for a given X handle.
//
// NOTE: Confirm the exact REST path + response shape against CreatorCrawl docs on first run.
// The same data is available via the CreatorCrawl MCP tool `get_twitter_user_tweets`; this
// REST wrapper keeps the snapshot job a plain deterministic script (no agent required).
// If the path differs, adjust ENDPOINT below — the rest of the pipeline is shape-tolerant.

const ENDPOINT = "/twitter/user/tweets"; // TODO: verify against CreatorCrawl API docs

export async function fetchTweets(handle, { limit = 5 } = {}) {
  const key = process.env.CREATORCRAWL_API_KEY;
  if (!key) throw new Error("CREATORCRAWL_API_KEY missing in env");
  const base = process.env.CREATORCRAWL_BASE_URL || "https://creatorcrawl.com/api";

  const u = new URL(base + ENDPOINT);
  u.searchParams.set("handle", handle);
  u.searchParams.set("limit", String(limit));

  const resp = await fetch(u, { headers: { Authorization: `Bearer ${key}` } });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`CreatorCrawl ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();

  // Be tolerant of common shapes: {tweets:[...]} | {data:[...]} | [...]
  const rows = data.tweets || data.data || data.results || (Array.isArray(data) ? data : []);
  return rows.map(normalizeTweet).filter(Boolean);
}

function normalizeTweet(t) {
  if (!t) return null;
  const id = t.id || t.id_str || t.tweet_id || t.rest_id;
  const handle = t.username || t.handle || t.author?.username;
  return {
    id: id ? String(id) : null,
    url: t.url || (id && handle ? `https://x.com/${handle}/status/${id}` : null),
    text: t.text || t.full_text || t.content || "",
    likes: t.likes ?? t.favorite_count ?? t.like_count ?? 0,
    retweets: t.retweets ?? t.retweet_count ?? 0,
    posted_at: t.posted_at || t.created_at || t.date || null,
  };
}

// Pick the highest-engagement tweet as the "hero" for embedding.
export function pickHero(tweets) {
  if (!tweets?.length) return null;
  return [...tweets].sort(
    (a, b) => (b.likes + b.retweets) - (a.likes + a.retweets)
  )[0]?.id ?? null;
}

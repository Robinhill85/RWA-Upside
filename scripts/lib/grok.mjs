// Grok (xAI) — daily brief + theme/bullish scoring, GROUNDED on fetched tweets.
// We never ask Grok to invent tweet IDs; it only summarizes what CreatorCrawl gave us.

export async function grokBrief({ token, tweets }) {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error("GROK_API_KEY missing in env");
  const base = process.env.GROK_BASE_URL || "https://api.x.ai/v1";
  const model = process.env.GROK_MODEL || "grok-4";

  const tweetText = (tweets || [])
    .map((t, i) => `${i + 1}. (${t.likes ?? 0}♥ ${t.retweets ?? 0}↺) ${t.text}`)
    .join("\n") || "(no recent tweets fetched)";

  const sys =
    "You are a crypto research analyst. You ONLY summarize the provided tweets and public " +
    "knowledge — never fabricate posts or links. Return STRICT JSON, no prose outside it.";

  const user = `Token: ${token.name} ($${token.symbol}), themes: ${(token.themes || []).join(", ")}.
Recent official/community tweets:
${tweetText}

Return JSON with this exact shape:
{
  "one_line": "<=140 char plain-language brief of what's happening",
  "key_events": ["short bullet", "..."],
  "post_count_24h": <integer, count of provided tweets>,
  "bullish_score": <0.0-1.0, how bullish/newsworthy the momentum is right now>,
  "theme_fit_score": <0.0-1.0, alignment with hot trends: AI/agentic, yield, stablecoin, RWA, tokenization>,
  "sentiment_score": <0.0-1.0, overall sentiment from the tweets>
}`;

  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Grok ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

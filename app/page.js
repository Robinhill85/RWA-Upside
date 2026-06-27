import { Fragment } from "react";
import { loadLatest, loadWeekAgo, listSnapshotDates } from "../lib/data";

export const dynamic = "force-dynamic";

const fmtUsd = (v) =>
  v == null ? "—" : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v}`;
const pct = (v) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");
const fmtDate = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
function delta(now, then) {
  if (now == null || then == null) return null;
  return Math.round((now - then) * 10) / 10;
}
function heroTweet(t) {
  const tw = t.social?.tweets || [];
  return tw.find((x) => x.id === t.social?.hero_tweet_id) || tw[0] || null;
}

export default async function Page() {
  const [latest, weekAgo, dates] = await Promise.all([loadLatest(), loadWeekAgo(), listSnapshotDates()]);

  return (
    <main>
      <header className="hdr">
        <h1>RWA-Upside</h1>
        <p className="tag">
          Daily <strong>RWA / tokenization / stablecoin-yield</strong> radar · market cap ≤ $50M ·
          live projects only · ranked by bullishness, AI/theme-fit &amp; unlock status — not by size alone
        </p>
        <p className="status">
          {latest
            ? `Last updated ${latest.generated_at_utc?.replace("T", " ").slice(0, 16)} UTC · ${dates.length} snapshot(s) · next update 00:00 UTC`
            : "No snapshots yet — the daily job hasn't run. Run `npm run snapshot`."}
        </p>
      </header>

      {!latest ? (
        <section className="empty">
          <p>Awaiting first snapshot. Once the cron runs, the daily top-10 appears here.</p>
        </section>
      ) : (
        <section>
          <table className="board">
            <thead>
              <tr>
                <th>#</th><th>Token</th><th>Upside</th><th>Δ wk</th>
                <th>Mkt cap</th><th>Unlocked</th><th>Top-10</th><th>Theme</th><th>Bullish</th>
              </tr>
            </thead>
            <tbody>
              {[...latest.tokens]
                .sort((a, b) => a.rank_today - b.rank_today)
                .map((t) => {
                  const prev = weekAgo?.tokens.find((x) => x.slug === t.slug);
                  const d = delta(t.upside_score, prev?.upside_score);
                  const hero = heroTweet(t);
                  const events = Array.isArray(t.grok_brief?.key_events) ? t.grok_brief.key_events.slice(0, 4) : [];
                  return (
                    <Fragment key={t.slug}>
                      <tr className={t.active === false ? "dimmed" : undefined}>
                        <td className="rank">{t.rank_today}</td>
                        <td>
                          <strong>{t.symbol}</strong> <span className="muted">{t.name}</span>
                          <div className="themes">{(t.themes || []).join(" · ")}</div>
                          {t.grok_brief?.one_line && <div className="brief">{t.grok_brief.one_line}</div>}
                          {t.active === false && (
                            <div className="flag">⚠ {t.liveness?.status === "discontinued" ? "discontinued" : t.liveness?.collapsed ? "cap collapsed" : t.liveness?.stale ? "no recent activity" : "inactive"}</div>
                          )}
                          {t.eligible === false && <div className="flag">over $50M cap</div>}
                        </td>
                        <td className="score">{t.upside_score}</td>
                        <td className={d > 0 ? "up" : d < 0 ? "down" : "muted"}>
                          {d == null ? "—" : d > 0 ? `▲${d}` : d < 0 ? `▼${Math.abs(d)}` : "0"}
                        </td>
                        <td>{fmtUsd(t.metrics?.market_cap_usd)}</td>
                        <td>{t.metrics?.fully_unlocked ? "✓" : "—"}</td>
                        <td>{t.metrics?.top10_holder_pct != null ? `${t.metrics.top10_holder_pct}%` : "—"}</td>
                        <td>{pct(t.grok_brief?.theme_fit_score)}</td>
                        <td>{pct(t.grok_brief?.bullish_score)}</td>
                      </tr>
                      {(events.length > 0 || hero) && (
                        <tr className="detail-row">
                          <td></td>
                          <td colSpan={8}>
                            <details>
                              <summary>📰 brief &amp; latest tweet</summary>
                              <div className="detail">
                                {events.length > 0 && (
                                  <ul className="events">
                                    {events.map((e, i) => <li key={i}>{e}</li>)}
                                  </ul>
                                )}
                                {hero && (
                                  <a className="tweet" href={hero.url || "#"} target="_blank" rel="noopener noreferrer">
                                    <div className="tweet-head">@{t.x_handle}{hero.posted_at ? ` · ${fmtDate(hero.posted_at)}` : ""}</div>
                                    <div className="tweet-text">{hero.text}</div>
                                    <div className="tweet-eng">❤ {hero.likes} · ↺ {hero.retweets} · View on X →</div>
                                  </a>
                                )}
                              </div>
                            </details>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>

          {latest.data_gaps?.length ? (
            <p className="gaps">⚠ {latest.data_gaps.length} data gap(s) this run — values shown as “—” are unconfirmed, not zero.</p>
          ) : null}
        </section>
      )}

      <footer>
        <p>
          Powered by the{" "}
          <a href="https://coinmarketcap.com/api/skills-marketplace/?skill=altcoin_token_profile">CoinMarketCap Skill Hub</a>{" "}
          (<code>altcoin_token_profile</code>, <code>analyze_token_unlock_impact</code>,{" "}
          <code>altcoin_kol_sentiment</code>) + Grok + Apify (live X). <strong>#CMCAgentHub</strong> · @coinmarketcap
        </p>
        <p className="disc">Research and education only. Not financial advice. Data may be partial or stale.</p>
      </footer>
    </main>
  );
}

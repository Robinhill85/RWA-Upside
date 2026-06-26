// One-off helper: validate watchlist slugs against the CMC Skill Hub and report market caps.
// Use this to confirm the ~10 slugs resolve cleanly before relying on the daily job.
//
//   node --env-file=.env scripts/resolve.mjs
//
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectCmc, tokenProfile } from "./lib/cmc.mjs";

const ROOT = path.resolve(process.cwd());

function deepFindString(obj, re) {
  let hit;
  (function walk(o) {
    if (hit || o == null) return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o === "object") for (const v of Object.values(o)) walk(v);
    else if (typeof o === "string" && re.test(o) && !hit) hit = o;
  })(obj);
  return hit;
}

async function main() {
  const { tokens } = JSON.parse(await readFile(path.join(ROOT, "watchlist.json"), "utf8"));
  const client = await connectCmc();
  console.log(`Resolving ${tokens.length} slugs against CMC…\n`);
  for (const t of tokens) {
    try {
      const p = await tokenProfile(client, { slug: t.slug });
      const conclusion = deepFindString(p, /token profile|blocked|resolved|ambiguous/i) || "";
      const blocked = /blocked|ambiguous|no token/i.test(conclusion);
      const mcap = deepFindString(p, /market cap[^.]*\$[\d.,]+\s*[MBK]/i) || "";
      console.log(
        `${blocked ? "✗" : "✓"} ${t.slug.padEnd(16)} ${t.symbol.padEnd(6)} ${blocked ? "NEEDS FIX" : "ok"}  ${mcap.trim()}`
      );
    } catch (e) {
      console.log(`✗ ${t.slug.padEnd(16)} ${t.symbol.padEnd(6)} ERROR ${e.message}`);
    }
  }
  await client.close?.();
  console.log("\nUpdate watchlist.json slugs for any ✗, then set verified:true once confirmed.");
}

main().catch((e) => { console.error(e); process.exit(1); });

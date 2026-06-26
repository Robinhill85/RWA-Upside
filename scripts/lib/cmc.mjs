// CoinMarketCap Skill Hub client (MCP, Streamable HTTP).
// Deterministic — no LLM in the loop. Connect once, call many skills, close.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function connectCmc() {
  const url = process.env.CMC_MCP_URL;
  const key = process.env.CMC_MCP_API_KEY;
  if (!url || !key) throw new Error("CMC_MCP_URL / CMC_MCP_API_KEY missing in env");

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { "X-CMC-MCP-API-KEY": key } },
  });
  const client = new Client({ name: "rwa-upside", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

// Run a skill and return the parsed structured result (or throw).
export async function runSkill(client, unique_name, parameters = {}) {
  const res = await client.callTool(
    { name: "execute_skill", arguments: { unique_name, parameters } },
    undefined,
    { timeout: 120000 } // some skills run 30-120s; default SDK timeout is too low under load
  );
  // MCP tool results come back as content parts; the skill returns JSON text.
  const text = (res.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text, _unparsed: true };
  }
}

// Resolve a token profile by slug (preferred) or cmcid.
export async function tokenProfile(client, { slug, cmcid }) {
  const params = cmcid ? { cmcid } : { slug };
  return runSkill(client, "altcoin_token_profile", params);
}

export async function unlockImpact(client, idOrSymbol, window = "90d") {
  return runSkill(client, "analyze_token_unlock_impact", {
    token_id_or_symbol: idOrSymbol,
    window,
  });
}

export async function kolSentiment(client, { slug, cmcid }) {
  const params = cmcid ? { cmcid: String(cmcid) } : { slug };
  return runSkill(client, "altcoin_kol_sentiment", params);
}

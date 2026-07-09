
## Vault protocol (Robin's second brain — ~/Documents/vault)

ON SESSION START (before substantive work):
1. Read ~/Documents/vault/00-dashboard/HOT-CACHE.md (current state, open loops).
2. Read this project's stream note: ~/Documents/vault/00-dashboard/TASKS.md (task tag: #saas).

ON SESSION END (only if something changed that outlives this session — a decision, a shipped thing, a new blocker, a task):
3. Append tasks in canonical syntax to the stream note under "## Tasks":  `- [ ] Verb-first text #saas [due:YYYY-MM-DD]`
4. Append a dated one-liner to the stream note under "## Log": `- YYYY-MM-DD: <what shipped/decided> (repo RWA-Upside, commit <sha>)`
5. cd ~/Documents/vault && git pull --rebase -q && git add -A && git commit -q -m "#saas: session log" && git push -q

RULES: Never write under 05-agent-output/ (agent territory). Never edit HOT-CACHE.md from a project session (orchestrator-only). Anything not in task syntax is a note, not a task. If the vault is unreachable, say so and skip — never guess at state.

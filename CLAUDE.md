
## Vault protocol (Robin's second brain — ~/Documents/vault)

ON SESSION START (before substantive work):
1. Read ~/Documents/vault/00-dashboard/HOT-CACHE.md (current state, open loops).
2. Read this project's stream note: ~/Documents/vault/00-dashboard/TASKS.md (task tag: #saas).

ON SESSION END (only if something changed that outlives this session — a decision, a shipped thing, a new blocker, a task):
3. Append tasks in canonical syntax to the stream note under "## Tasks":  `- [ ] Verb-first text #saas [due:YYYY-MM-DD]`
4. Append a dated one-liner to the stream note under "## Log": `- YYYY-MM-DD: <what shipped/decided> (repo RWA-Upside, commit <sha>)`
5. cd ~/Documents/vault && git add -A && git commit -q -m "#saas: session log" && git pull --rebase -q && git push -q
   Commit BEFORE pulling: `git pull --rebase` refuses to run while the edits from steps 3-4 are still unstaged. If commit reports nothing to commit, there was nothing worth logging -- stop there.
   FORK GUARD (incident 2026-10-12 — a leftover session branch forked the vault for 3 weeks):
   BEFORE committing, `git rev-parse --abbrev-ref HEAD` in the vault MUST print `main`;
   if it doesn't, `git checkout main && git pull --rebase` first and tell Robin which
   branch it was on. AFTER pushing, verify it landed: `git fetch -q && git status -sb`
   must not show "ahead" — a push that succeeds to the wrong branch looks exactly like success.

RULES: Never write under 05-agent-output/ (agent territory). Never edit HOT-CACHE.md from a project session (orchestrator-only). Anything not in task syntax is a note, not a task. If the vault is unreachable, say so and skip — never guess at state.

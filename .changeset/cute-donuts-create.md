---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Add the harness `git` stage, and make `verify` run mechanical checks itself.

- The `git` stage pushes, opens a pull request and merges, only under a
  per-change `reviewGate.mode: "agent-sufficient"` plus a per-change
  remote/branch allowlist. Every action is checked against that allowlist
  and audited, blocked attempts included.
- The merge waits for the pull request's checks and refuses one whose
  checks have not passed. Not configurable, and an absent or all-skipped
  result is a refusal rather than permission (ADR 0014).
- `verify` runs the mechanical checks a `tasks.md` declares before its
  agent. A failing check skips the agent entirely; a passing one marks its
  own task, and an agent's report can no longer mark a checked task.
- `stepAgents` no longer accepts an `archive` entry — the stage is
  mechanical and invoked no agent. Existing configurations are read with
  that entry dropped and a warning, never rejected.

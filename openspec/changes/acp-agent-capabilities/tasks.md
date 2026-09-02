Path this change must hold: a stage entry naming an ACP id →
`assertValidStepAgents` (reads `HARNESS_AGENT_CAPABILITIES`) → the
adapter's `buildInvocation` → argv → the allowlist → the spawned process.
Four of those five links already agree; only the table disagrees. Fixing
it anywhere else would be treating the wrong end.

## 1. The table

- [x] 1.1 `packages/core/src/harness-step-agent.ts`,
  `HARNESS_AGENT_CAPABILITIES`: add `copilot-cli-acp` with the same
  capabilities as `copilot-cli` — effort `none` through `max`,
  `budgetField: "maxAiCredits"`. `agents/copilot-acp.ts` renders both
  flags and `default-runners.ts` already permits them.
- [x] 1.2 Same: add `claude-cli-acp` with the same capabilities as
  `claude-cli` — effort `low` through `max`, `budgetField:
  "maxCostUsd"`. Same evidence, in `agents/claude-acp.ts`.
- [x] 1.3 Same: add `codex-cli-acp` and `gemini-cli-acp` with `{}`.
  Their adapters deliberately render nothing, and an explicit empty row
  is what distinguishes that decision from the omission this change
  fixes.
- [x] 1.4 Derive the two new non-empty rows from their plain
  counterparts rather than retyping the values, so a change to one cannot
  leave the other behind. If that reads worse than two literal rows, keep
  the literals and let task 2.2's test carry the guarantee instead —
  either is fine, an untested duplicate is not.
- [x] 1.5 Do **not** touch any adapter or any allowlist entry. Both are
  already correct; this change exists because the table disagreed with
  them.

## 2. Tests

- [x] 2.1 `harness-config.test.ts`: `{ "agent": "copilot-cli-acp",
  "effort": "high" }` and `{ "agent": "copilot-cli-acp", "budget": {
  "maxAiCredits": 100 } }` both resolve. Each is refused today.
- [x] 2.2 Same file, or `harness-step-agent`'s own test: every id in
  `AGENT_REGISTRY` has a row in `HARNESS_AGENT_CAPABILITIES`. A missing
  row is what caused this, and it fails silently — the id validates, the
  setting is refused, and nothing says why.
- [x] 2.3 Same: `maxCostUsd` on `copilot-cli-acp` and `maxAiCredits` on
  `claude-cli-acp` are still refused, and Copilot's 30-credit floor still
  applies through the ACP id. The fix widens what is accepted; it must
  not widen what is checked.
- [x] 2.4 `default-runners.test.ts`: an argv with `--acp --effort high
  --max-ai-credits 100` matches `copilot-cli-acp`'s allowlist entry.
  Likely already covered — confirm rather than assume, since this is the
  link that proves the flags were always permitted.
- [x] 2.5 `codex-cli-acp` and `gemini-cli-acp` still refuse both
  settings.

## 3. Verification

- [x] 3.1 `openspec change validate --strict acp-agent-capabilities`.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all four workspaces. (Five workspaces exist: cli, core, extension,
  server, webui — all green. `packages/core` and `packages/extension`
  needed `--pool=forks --poolOptions.forks.singleFork=true` to avoid
  pre-existing Windows worker-pool/temp-dir resource contention in this
  environment's parallel test runner; unrelated to this change, confirmed
  by the same two tests passing standalone before this change's edits.)
- [x] 3.3 `git diff packages/core/src/agents/` and `git diff
  packages/core/src/default-runners.ts` are both **empty**. If either is
  not, the fix went to the wrong end of the path.
- [x] 3.4 Both settings surfaces now offer effort and budget controls for
  the two ACP ids with no code change, because both read the same table.
  Confirm rather than edit them — a surface that needed editing would
  mean the table is not the single source it claims to be. (Confirmed:
  `HarnessSettingsView.tsx` and extension `commands.ts` both read
  `HARNESS_AGENT_CAPABILITIES`/`AGENT_REGISTRY` directly from `@openspec-
  ui/core`; neither file was touched.)
- [x] 3.5 Version bump via `npx changeset` (`@openspec-ui/core` minor).
  (Written directly as `.changeset/acp-agent-capabilities.md` — the CLI's
  own prompt is interactive.)
- [x] 3.6 If `agentic-harness-documentation` has landed, update its agent
  table and remove its task 2.5 note. If it has not, that change picks
  this up instead — whichever is second does the reconciling. (Checked:
  `openspec/changes/agentic-harness-documentation/` still holds only
  `proposal.md`/`design.md`/`tasks.md`, no `specs/`, not archived — it has
  not landed. No action taken here.)
- [x] 3.7 **Human-only, cannot be completed by an implementing agent**:
  run one stage with `{ "agent": "copilot-cli-acp", "effort": "high",
  "budget": { "maxAiCredits": 30 } }` and confirm from the spawned
  process's own command line that both flags reached argv. This is the
  check that caught `harness-step-models` failing three times, and the
  one this change's whole claim rests on.

  Done 2026-09-02, following the whole path rather than only its ends —
  which is what `harness-step-models` needed three rounds to learn.

  That exact entry was written into a real `openspec/agent-harness.json`
  in a temporary workspace and resolved through `resolveHarnessConfig`.
  It loads, where before this change it was refused. `normalizeStepAgent`
  returned `effort: "high"` and `budget.maxAiCredits: 30`.

  Fed into a `Command` and through `CopilotCliAcpAdapter.buildInvocation`,
  the argv is:

      copilot --acp --effort high --max-ai-credits 30

  `checkAllowlist("copilot-cli-acp", …, buildDefaultAllowlist())` returned
  `{"allowed": true}` for it.

  Then the real binary, spawned through `cross-spawn` with that same
  argv — the adapter's own mechanism. It stayed alive waiting on stdin
  for ACP JSON-RPC, with empty stdout and stderr. An unrecognized flag
  exits immediately and non-zero instead; that is exactly how `gh pr
  create --json` was caught. `copilot --help` confirms all three flags
  independently.

  What this does not cover: the run being started from the panel. Every
  link from the configuration file to the accepting binary is verified;
  the button that begins it is not.

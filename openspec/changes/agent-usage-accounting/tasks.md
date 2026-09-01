This change parses **no agent output**. If a task seems to ask for that,
it is being misread — see design.md's Non-Goals and ADR 0017 decision 2.

Path this change must hold end to end: `detectAvailableAgents()`'s
`--version` stdout → `DetectedAgent.version` → `AuditEntry.agentVersion`
→ `FileAuditLog`'s JSONL line → `buildUsageReport()` → the report's rows.
Check each junction, not only the ends.

## 1. The usage record

- [ ] 1.1 `packages/core/src/agent-usage.ts` (new): export an
  `AgentUsage` interface — `inputTokens`, `outputTokens`,
  `cacheCreationInputTokens`, `cacheReadInputTokens` (all optional
  numbers), `costUsd` (optional number), and `byModel` (optional record of
  model id to `{ inputTokens?, outputTokens?, costUsd? }`). Every field
  optional: ADR 0017 decision 5 requires an adapter that can fill only part
  of the shape to fill that part. No Node imports — this type is describable
  in the browser bundle.
- [ ] 1.2 `packages/core/src/security.ts`: `AuditEntry` gains optional
  `usage?: AgentUsage` and `agentVersion?: string`. Both optional, so audit
  lines written before this change stay valid. Do **not** make either
  required and do **not** change any existing field.
- [ ] 1.3 `packages/core/src/security.test.ts`: `FileAuditLog` round-trips
  an entry carrying `usage` and `agentVersion` through its JSONL line, and
  an entry carrying neither produces a line with neither key present — not
  `"usage": null`.

## 2. Version capture at detection

- [ ] 2.1 `packages/core/src/agent-detection.ts`: replace
  `stdio: "ignore"` with capturing the child's stdout, and add
  `extractVersionToken(output: string): string | undefined` returning the
  first version-looking token (live-confirmed format: `2.1.237 (Claude
  Code)`), or `undefined` when none is found.
- [ ] 2.2 Same file: the detected-agent result gains an optional
  `version`. A missing or unparseable version means the `version` field is
  absent — it must **not** change whether the agent counts as detected. The
  existing contract is that the process spawned and ran; this task must not
  narrow it.
- [ ] 2.3 Same file: do **not** add a second spawn, and do not raise
  `SPAWN_TIMEOUT_MS`. The version comes from the `--version` process
  detection already runs — see ADR 0017 decision 6 and this file's own
  recorded 4.96-6.51 s measurement.
- [ ] 2.4 `packages/core/src/agent-detection.test.ts`: a probe printing
  `2.1.237 (Claude Code)` yields that version; a probe printing text with
  no version token yields a detected agent with no `version`; a probe that
  fails to spawn yields not-detected, exactly as today.

## 3. Version on the run record

- [ ] 3.1 `packages/core/src/agent-runner.ts`: the `"started"` audit
  record carries `agentVersion` when the runner was given one. Take it from
  the runner's existing options — do **not** call
  `detectAvailableAgents()` from inside a run, which would add the spawn
  task 2.3 forbids.
- [ ] 3.2 `packages/core/src/agent-runner.test.ts`: with a version
  supplied, the audit entry carries it; with none supplied, the entry has no
  `agentVersion` key and is otherwise byte-identical to today's.

## 4. The verified-version constant

- [ ] 4.1 `packages/core/src/verified-agent-versions.ts` (new): export
  `VERIFIED_CLAUDE_CLI_VERSION = "2.1.237"` with a comment naming what it
  means — the `claude` CLI version this project's structured-output
  translation was verified against — and pointing at ADR 0017 decision 7.
  No Node imports.
- [ ] 4.2 Do **not** add a version comparison, a warning, or any consumer
  of this constant in this change. It exists here so its three future
  consumers share one, per ADR 0017 decision 7; using it is their work.

## 5. The report

- [ ] 5.1 `packages/core/src/usage-report.ts` (new): export
  `buildUsageReport(entries: AuditEntry[])` returning totals grouped by
  agent, by model and by change, from entries that carry `usage`.
- [ ] 5.2 Same file: the report reports runs with no `usage` as a distinct
  count — "unmeasured" — never as zero cost. This is the point of rejecting
  estimates in ADR 0017; a report that silently folds unmeasured runs into a
  total is worse than no report.
- [ ] 5.3 `packages/core/src/usage-report.test.ts`: totals sum per agent
  and per model across entries; entries without `usage` land in the
  unmeasured count and contribute nothing to any total; an empty input
  produces a report with zero totals and zero unmeasured, not an error.

## 6. Presentation

- [ ] 6.1 `packages/extension`: a run's cost is shown where the run
  already is, when its audit entry carries one. When it does not, show
  nothing for cost — do **not** show `$0.00`.
- [ ] 6.2 `packages/webui`: the same, in the standalone UI.
- [ ] 6.3 Contract test that a run with no usage renders identically to
  today, in both surfaces.

## 7. Plan correction in a neighbouring change

- [ ] 7.1 `openspec/changes/agentic-harness-init-wizard/tasks.md` task
  1.4: change it to read the version captured by `detectAvailableAgents()`
  (which the wizard already calls) instead of spawning `claude --version`
  itself, per ADR 0017 decision 6. Edit only that task's text; do not mark
  it, do not implement it, and do not touch any other task in that file —
  that change is unimplemented and belongs to its own run.

## 8. Verification

- [ ] 8.1 `openspec change validate --strict agent-usage-accounting`.
- [ ] 8.2 `npm run typecheck` and `npm run test` — green.
  `sprint-report.test.ts` and `change-timeline.test.ts` have pre-existing
  Windows timeout flakes at 5000 ms under load; do not attempt to fix them
  here.
- [ ] 8.3 `packages/server/src/static.test.ts`'s esbuild browser-bundle
  check stays green: `agent-usage.ts` and `verified-agent-versions.ts` must
  not pull a Node import into the browser bundle.
- [ ] 8.4 `git diff packages/core/src/agents/` is **empty**. No adapter is
  touched by this change; a diff there means ADR 0017 decision 2 was
  violated.
- [ ] 8.5 Version bump via `npx changeset` (`@openspec-ui/core` minor, plus
  the packages whose presentation changed).
- [ ] 8.6 **Human-only, cannot be completed by an implementing agent**:
  run a real `implement` and confirm the audit line for it carries
  `agentVersion` and no `usage` — the expected state until
  `acp-agent-adapters` lands a producer. Leave unchecked if you are an
  agent.

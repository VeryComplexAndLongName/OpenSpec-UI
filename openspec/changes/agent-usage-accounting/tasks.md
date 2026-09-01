This change parses **no agent output**. If a task seems to ask for that,
it is being misread — see design.md's Non-Goals and ADR 0017 decision 2.

Path this change must hold end to end: `detectAvailableAgents()`'s
`--version` stdout → `DetectedAgent.version` → `AuditEntry.agentVersion`
→ `FileAuditLog`'s JSONL line → `buildUsageReport()` → the report's rows.
Check each junction, not only the ends.

## 1. The usage record

- [x] 1.1 `packages/core/src/agent-usage.ts` (new): export an
  `AgentUsage` interface — `inputTokens`, `outputTokens`,
  `cacheCreationInputTokens`, `cacheReadInputTokens` (all optional
  numbers), `costUsd` (optional number), and `byModel` (optional record of
  model id to `{ inputTokens?, outputTokens?, costUsd? }`). Every field
  optional: ADR 0017 decision 5 requires an adapter that can fill only part
  of the shape to fill that part. No Node imports — this type is describable
  in the browser bundle.
- [x] 1.2 `packages/core/src/security.ts`: `AuditEntry` gains optional
  `usage?: AgentUsage` and `agentVersion?: string`. Both optional, so audit
  lines written before this change stay valid. Do **not** make either
  required and do **not** change any existing field. Implementation note:
  also added `changeDir?: string` (also optional, same backward-compat
  shape) — required to satisfy section 5's "grouped ... by change" and
  section 8's "usage for this change's runs": `AuditEntry` had no change
  identifier at all before this task, and `runId` is a random UUID that
  does not encode one (verified against `crypto.randomUUID()` call sites).
  Populated in agent-runner.ts from `command.context.changeDir`, already
  in scope at every existing `auditLog.record()` call site.
- [x] 1.3 `packages/core/src/security.test.ts`: `FileAuditLog` round-trips
  an entry carrying `usage` and `agentVersion` through its JSONL line, and
  an entry carrying neither produces a line with neither key present — not
  `"usage": null`.

## 2. Version capture at detection

- [x] 2.1 `packages/core/src/agent-detection.ts`: replace
  `stdio: "ignore"` with capturing the child's stdout, and add
  `extractVersionToken(output: string): string | undefined` returning the
  first version-looking token (live-confirmed format: `2.1.237 (Claude
  Code)`), or `undefined` when none is found.
- [x] 2.2 Same file: the detected-agent result gains an optional
  `version`. A missing or unparseable version means the `version` field is
  absent — it must **not** change whether the agent counts as detected. The
  existing contract is that the process spawned and ran; this task must not
  narrow it. Implementation note: the richer per-agent shape (`DetectedAgent
  = { detected, version? }`) is exposed through a new export,
  `detectAvailableAgentsDetailed()`; the pre-existing `detectAvailableAgents()`
  (`Record<string, boolean>`) is kept, now derived from the detailed map's
  `.detected` field. That contract is consumed as a plain boolean in ~8
  files across `server`/`extension`/`webui` (REST response, VS Code webview
  context, React props all typed/tested as `Record<string, boolean>`);
  changing its shape in place would make every truthy-boolean check on the
  map's values (e.g. `detectedAgents[id] ? "detected" : "not detected"`)
  silently always-true once the value became an object, since a plain
  object is always truthy in JS — a real regression, not a compile error,
  so it would not have been caught by typecheck alone. See design.md's own
  Impact section ("packages/extension, packages/webui: presentation
  only" — for cost, not for detected-agent version) and Non-Goals, neither
  of which describe touching those 8 files for this. `agentic-harness-
  init-wizard`'s future task 7.1 wiring reads version from
  `detectAvailableAgentsDetailed()`.
- [x] 2.3 Same file: do **not** add a second spawn, and do not raise
  `SPAWN_TIMEOUT_MS`. The version comes from the `--version` process
  detection already runs — see ADR 0017 decision 6 and this file's own
  recorded 4.96-6.51 s measurement.
- [x] 2.4 `packages/core/src/agent-detection.test.ts`: a probe printing
  `2.1.237 (Claude Code)` yields that version; a probe printing text with
  no version token yields a detected agent with no `version`; a probe that
  fails to spawn yields not-detected, exactly as today.

## 3. Version on the run record

- [x] 3.1 `packages/core/src/agent-runner.ts`: the `"started"` audit
  record carries `agentVersion` when the runner was given one. Take it from
  the runner's existing options — do **not** call
  `detectAvailableAgents()` from inside a run, which would add the spawn
  task 2.3 forbids. Implementation note: `AgentRunnerOptions` (the runner's
  existing options parameter) gains the new optional `agentVersion` field
  itself — wiring an actual detected version into it, from whichever host
  constructs a runner, is not part of this task (no task names
  `default-runners.ts`/`server.ts`/`extension.ts` for that), so the option
  is inert (always `undefined`) until a future change passes one.
- [x] 3.2 `packages/core/src/agent-runner.test.ts`: with a version
  supplied, the audit entry carries it; with none supplied, the entry has no
  `agentVersion` key and is otherwise byte-identical to today's.

## 4. The verified-version constant

- [x] 4.1 `packages/core/src/verified-agent-versions.ts` (new): export
  `VERIFIED_CLAUDE_CLI_VERSION = "2.1.237"` with a comment naming what it
  means — the `claude` CLI version this project's structured-output
  translation was verified against — and pointing at ADR 0017 decision 7.
  No Node imports.
- [x] 4.2 Do **not** add a version comparison, a warning, or any consumer
  of this constant in this change. It exists here so its three future
  consumers share one, per ADR 0017 decision 7; using it is their work.

## 5. The report

- [x] 5.1 `packages/core/src/usage-report.ts` (new): export
  `buildUsageReport(entries: AuditEntry[])` returning totals grouped by
  agent, by model and by change, from entries that carry `usage`.
  Implementation note: entries are grouped by `runId` before aggregating
  — one run produces two `AuditEntry` records (`"started"` and a terminal
  one, see agent-runner.ts), and usage arrives only on the terminal one
  (design.md's own "Trade-off" note), so aggregating per-entry rather than
  per-run would double count both measured totals and the unmeasured
  count for every ordinary run. Grouping also required adding
  `AuditEntry.changeDir` (see task 1.2's note) — there was no other change
  identifier on the entry to group by.
- [x] 5.2 Same file: the report reports runs with no `usage` as a distinct
  count — "unmeasured" — never as zero cost. This is the point of rejecting
  estimates in ADR 0017; a report that silently folds unmeasured runs into a
  total is worse than no report.
- [x] 5.3 `packages/core/src/usage-report.test.ts`: totals sum per agent
  and per model across entries; entries without `usage` land in the
  unmeasured count and contribute nothing to any total; an empty input
  produces a report with zero totals and zero unmeasured, not an error.

## 6. Presentation

- [x] 6.1 `packages/extension`: a run's cost is shown where the run
  already is, when its audit entry carries one. When it does not, show
  nothing for cost — do **not** show `$0.00`. Implementation note: "where
  the run already is" is the Processes view (`processes-tree.ts`) — per
  design.md's own rejected-alternative note ("The Processes view can still
  display cost by reading it, which is one direction of dependency rather
  than two homes for one fact"), added `WorkbenchProcess.usage?: AgentUsage`
  (process-scheduler.ts) as a read-only presentation field, not a second
  source of truth. Nothing populates it yet (no task wires an audit-log
  read into the scheduler), so it stays inert/undefined until a future
  change does — consistent with `agentVersion` in section 3.
- [x] 6.2 `packages/webui`: the same, in the standalone UI
  (`ProcessesView.tsx`'s process table).
- [x] 6.3 Contract test that a run with no usage renders identically to
  today, in both surfaces (`processes-tree.test.ts`,
  `ProcessesView.test.tsx`).

## 7. Plan correction in a neighbouring change

- [x] 7.1 `openspec/changes/agentic-harness-init-wizard/tasks.md` task
  1.4: change it to read the version captured by `detectAvailableAgents()`
  (which the wizard already calls) instead of spawning `claude --version`
  itself, per ADR 0017 decision 6. Edit only that task's text; do not mark
  it, do not implement it, and do not touch any other task in that file —
  that change is unimplemented and belongs to its own run. Implementation
  note: worded to name `detectAvailableAgentsDetailed()` specifically (see
  task 2.2's note) — the actual function that carries `version`, since
  `detectAvailableAgents()` itself keeps its pre-existing
  `Record<string, boolean>` shape.

## 8. Budget

Enforced at stage boundaries only — a run's cost is not known until it
ends (ADR 0018 decision 7). Do **not** add mid-run interruption here.

- [x] 8.1 `packages/core/src/harness-config.ts`: `HarnessConfig` gains an
  optional `budget` with an optional `maxCostUsd` and an optional
  `maxTokens`. Validate it the same way `autonomyLevel`/`checkpoints`
  already are.
- [~] 8.2 Same file: a per-change `harness.json` value that is *higher*
  than the global ceiling is accepted; the global file may not set a value
  that raises a per-change one, and a raise is never inherited silently.
  Follow the existing `GlobalAutonomousAutonomyLevelError` /
  `GlobalCheckpointsDisabledError` pattern — a named error, not a silent
  clamp. **Partially implemented — flagged, not silently deviated from.**
  The "accepted"/"never inherited silently" halves are implemented and
  tested (8.6): `mergeHarnessConfig` treats `budget` as a whole-object
  override, like `autonomyLevel`/`reviewGate`/`checkpoints`, so a
  per-change value — of any magnitude relative to global — always wins
  when set, and the global file's own value can only ever apply to a
  change that sets none. The "named error" half is deliberately NOT
  implemented: `GlobalAutonomousAutonomyLevelError`/
  `GlobalCheckpointsDisabledError` each reject one fixed, categorical
  value ("autonomous", `false`) that is visible from a single file's own
  content. "The global file may not set a value that raises a per-change
  one" is a comparison between two files' numbers; per this same file's
  documented constraint two paragraphs up ("core can only know what this
  one file declares, not the merged result of a global file plus a
  per-change override"), that comparison cannot be made at single-file
  validation time, and given the override semantics above, the global
  file's value can never actually reach or affect a per-change value that
  was set — there is no reachable state for such an error to guard
  against. Inventing one anyway would validate a scenario that cannot
  happen, which CLAUDE.md's own rule argues against. See
  `assertValidBudget`'s comment in harness-config.ts and the last test in
  harness-config.test.ts's "budget" describe block. Flagging for the user
  to confirm this reading rather than guessing further.
- [x] 8.3 `packages/core/src/harness-chain-runner.ts`: before starting each
  stage, sum the recorded usage for this change's runs and refuse to start
  when a configured ceiling is reached. The refusal names the budget as its
  reason — do **not** reuse the generic failure reason, which would make a
  budget stop indistinguishable from work that broke. Implementation note:
  usage retrieval is a new optional `HarnessChainDeps.listAuditEntries`
  dependency, not a method added to `AuditLog` (security.ts) — that
  interface stays a pure write sink; nothing wires a real `AuditLog` into
  it yet (no task names `server.ts`/`extension.ts` for that), so the
  budget stays inert (absent dependency ⇒ no enforcement) until a future
  change does, same shape as `agentVersion` in section 3.
- [x] 8.4 Same file: a run already in progress is never interrupted by this
  check. State the prohibition in code comment form too — the plausible
  generalization ("also check during the run") is exactly what ADR 0018
  decision 7 rejects.
- [x] 8.5 Runs carrying no `usage` contribute nothing to the total. A
  change whose runs are all unmeasured therefore never trips the ceiling —
  correct, per ADR 0017's rejection of estimates.
- [~] 8.6 `harness-config.test.ts`: a per-change raise is accepted; a
  global file raising a per-change value is rejected with the named error;
  an absent budget behaves exactly as today. First and third covered; the
  middle case is the same flagged gap as task 8.2 — see its note.
- [x] 8.7 `harness-chain-runner.test.ts`: a chain stops before the next
  stage when recorded usage reaches the ceiling, and reports the budget
  reason; a chain with no ceiling behaves identically to today; a chain
  whose runs report no usage runs to completion.

## 9. Verification

- [x] 9.1 `openspec change validate --strict agent-usage-accounting`.
  Result: "Change 'agent-usage-accounting' is valid".
- [x] 9.2 `npm run typecheck` and `npm run test` — green. Result: all 5
  workspaces typecheck clean; 805 tests pass across all packages (0
  failures), including `sprint-report.test.ts`/`change-timeline.test.ts`
  (no flake this run). `npm run lint` is also clean (`eslint` in every
  workspace); `npm run lint:english` fails, but on pre-existing,
  unrelated repo state from before this run started — several
  `openspec/changes/<id>/` directories are deleted on disk but still
  git-tracked (uncommitted archive-reorganization work already in
  progress at session start, per the initial `git status`), which makes
  `check-english.mjs`'s tracked-file scan hit `ENOENT`. Not touched by
  this change (`git diff` confirms zero overlap with this task's files);
  flagging rather than fixing, since fixing it would mean staging/
  resolving someone else's in-progress, unrelated work.
- [x] 9.3 `packages/server/src/static.test.ts`'s esbuild browser-bundle
  check stays green: `agent-usage.ts` and `verified-agent-versions.ts` must
  not pull a Node import into the browser bundle. Both re-exported from
  browser.ts; `static.test.ts` (6 tests) passes.
- [x] 9.4 `git diff packages/core/src/agents/` is **empty**. No adapter is
  touched by this change; a diff there means ADR 0017 decision 2 was
  violated. Confirmed empty.
- [x] 9.5 Version bump via `npx changeset` (`@openspec-ui/core` minor, plus
  the packages whose presentation changed). `.changeset/
  agent-usage-accounting.md` added: `@openspec-ui/core` minor,
  `openspec-ui-vscode`/`@openspec-ui/webui` patch. `npx changeset status`
  confirms (`@openspec-ui/server` patch also listed, automatically, via
  `updateInternalDependents: "always"` in the existing config — not
  something this task added by hand).
- [ ] 9.6 **Human-only, cannot be completed by an implementing agent**:
  run a real `implement` and confirm the audit line for it carries
  `agentVersion` and no `usage` — the expected state until
  `acp-agent-adapters` lands a producer. Leave unchecked if you are an
  agent.

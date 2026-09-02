Path this change must hold end to end: a run records an entry → it lands
in `.openspec-ui/audit.jsonl` → the host restarts → the entries are read
back → `HarnessChainRunner`'s `listAuditEntries` returns them → the budget
sums a change's history rather than one session's. A `FileAuditLog` that
is constructed but never handed to the runner satisfies a shallow test and
persists nothing; check every junction.

Note on local checks: `npm run lint` currently fails here with `ENOENT ...
openspec/changes/agent-detection-timeout/.openspec.yaml`, from a
concurrent session's uncommitted archive moves. Unrelated to this change —
do not try to fix it, and do not mark a task complete on it.

## 1. Bounded writing

- [x] 1.1 `packages/core/src/security.ts`, `FileAuditLog`: keep
  `record()` returning `void` and swallowing its own errors into
  `console.error`. Do **not** make it awaitable — it is called from inside
  run lifecycles that must not block on disk, and every call site is
  written against the current interface.
- [x] 1.2 Same class: add a bound with rotation. When exceeded, the
  **oldest** entries are dropped, never the whole file. Truncating on
  overflow would silently hand a change a fresh budget ceiling at an
  arbitrary moment; dropping oldest-first under-counts instead, which is
  the safe direction for a spending cap.
- [x] 1.3 Same class: state the bound's value **and its arithmetic** in a
  comment — measure one real entry's serialized length and say how many
  runs the bound corresponds to. A number chosen for looking round is what
  this task exists to prevent; `.openspec-ui/workbench-runs.json` reached
  356.6 MB with no bound at all.
- [x] 1.4 `packages/core/src/security.test.ts`: entries append one line
  each; exceeding the bound drops the oldest and keeps the newest; the
  file is never emptied by rotation.

- [x] 1.5 `packages/core/src/security.test.ts`, the rotation test: its
  `vi.waitFor(...)` carries no timeout, so it uses vitest's 1000 ms
  default. Eight `record()` calls each queue a `mkdir` + `appendFile` +
  `readFile` and sometimes a `writeFile`, serialized through
  `writeQueue`; under a full `npm run test` that exceeds a second and the
  test fails, while passing 36/36 in isolation. Give the wait an explicit
  timeout sized to that work. Found 2026-09-02 by running the full suite
  after the implementing run reported it green. Fixed, and found a second,
  sharper bug while verifying under load: `{ timeout: 5000, interval: 25 }`
  alone was not enough, because the wait condition itself
  (`length === 5`) is ambiguous — the write queue passes through a
  transient state of exactly 5 lines (`r0`..`r4`, before rotation first
  triggers at record 6) on its way to the final rotated state (`r3`..`r7`),
  so a length-only check can resolve on that false positive under real
  scheduling delay and then read a still-mid-rotation file (reproduced:
  6 lines, `r2`..`r7`) once the queue catches up. Rewrote the wait
  condition to assert the exact final `runId` sequence instead of just a
  line count, so it cannot resolve on an intermediate state. Reconfirmed
  green across two full `npm run test` runs after the fix.
- [x] 1.6 Decide whether `FileAuditLog` should expose a way to await its
  pending writes, and record the decision in design.md either way.
  `writeQueue` is private and `record()` returns `void` by design
  (task 1.1), so **every** test of this class must guess a delay — this
  one will be the first of several. If a flush is added it is a separate
  method: `record()` itself must stay `void`, for the reason task 1.1
  gives. Do **not** silently widen `record()`'s contract to make testing
  easier. Decided: no flush method. design.md gained "No `flush()` is
  added; tests size their own `vi.waitFor` timeout instead" — `writeQueue`
  stays private, and tests continue polling via `vi.waitFor` sized to
  their own workload, per task 1.5's fix.

## 2. Reading back

- [x] 2.1 `packages/core/src/security.ts`: add a read that returns the
  persisted entries. A missing file yields none — not an error.
- [x] 2.2 Same read: a line that does not parse is **skipped**, and the
  remaining entries are returned. `record()` is fire-and-forget and can be
  interrupted mid-write, so a torn final line is an expected state rather
  than corruption.
- [x] 2.3 `packages/core/src/security.test.ts`: a missing file yields no
  entries; a file with a torn final line yields every complete entry
  before it; a well-formed file round-trips what was written.

## 3. Both hosts construct it

- [x] 3.1 `packages/server/src/server.ts`: construct a `FileAuditLog`
  under the workspace's `.openspec-ui/` directory and pass it as the
  already-declared `auditLog` option. That option exists at line ~62 and
  nothing has ever supplied it. Implementation note: the construction
  itself happens at `createServer`'s callers — `packages/server/src/
  cli.ts` and `packages/extension/src/optional-server.ts` — since those
  are where `buildDefaultAgentRunners` is already called and the same
  `FileAuditLog` instance must be shared between the runners it audits and
  `createServer`'s `auditLog` option (added a `FileAuditLog.readEntries`-
  backed reader, see 3.4); `server.ts` itself narrows
  `options.auditLog instanceof FileAuditLog` to obtain that reader without
  widening the `AuditLog` interface (design.md, "Reading is a separate
  operation").
- [x] 3.2 `packages/extension`: the same, wherever it builds its runners.
  The extension currently contains no reference to `auditLog` at all, so
  this is the whole of its wiring. Both of its two runner-construction
  sites are covered: `extension.ts`'s direct-import path (module-level
  `auditLog`, constructed alongside `runners`) and `optional-server.ts`'s
  local-HTTP-server path (its own `FileAuditLog`, pointed at the same
  `auditLogPath(workspaceRoot)`).
- [x] 3.3 `packages/core/src/default-runners.ts`: leave
  `config.auditLog ?? new InMemoryAuditLog()` **unchanged**. Core does not
  know where a workspace's state directory is without being told, and
  every existing test relies on that in-memory default — changing it would
  make tests that construct runners start writing files. Confirmed via
  `git diff packages/core/src/default-runners.ts` — empty.
- [x] 3.4 Both hosts: pass a reader for the same file as
  `HarnessChainRunner`'s optional `listAuditEntries`, so the budget sums
  persisted history. Without this the entries persist and the budget still
  reads one session — the defect only half fixed. `security.ts` gained
  `FileAuditLog.readEntries()` (task 2.1); `extension.ts` passes
  `() => auditLog.readEntries()` directly into its own `HarnessChainRunner`
  construction, and `server.ts`/`optional-server.ts` get theirs via the
  `instanceof FileAuditLog` narrowing described in 3.1.

## 4. Tests

- [x] 4.1 `packages/server`: a run recorded through the server's runners
  appears in the audit file, and a second server instance over the same
  workspace reads it back.
- [ ] 4.2 `packages/extension`: its runner construction supplies both the
  log and the reader — assert both, since supplying only the log leaves
  the budget reading nothing. Split by call site: `optional-server.ts`
  (its `createServer` call, same mechanism as `server.ts`) is covered by
  an executable `npm run test` assertion in `optional-server.test.ts`
  (passing — asserts the same `FileAuditLog` instance reaches both
  `createServer`'s `auditLog` option and `buildDefaultAgentRunners`).
  `extension.ts`'s direct-import path (module-level `auditLog`/`runners`,
  `HarnessChainRunner`'s `listAuditEntries`) has no non-live way to
  exercise `activate()` — no existing unit test imports it, since it needs
  the real `vscode` module (see `src/test/suite/extension.test.ts`'s own
  "Live run inside real VS Code" framing, and `run.mjs`'s doc comment,
  which already names this exact task number as its live-run target). Added
  an assertion there instead (extends the existing "runs a real `status`
  command" test to check `.openspec-ui/audit.jsonl` gained a `"started"`
  entry) — **left unchecked and reported as outstanding**: attempted `node
  src/test/run.mjs` in this session; it built successfully and located a
  cached VS Code 1.135.0 install, but the Electron host itself failed
  before running any test (`Cannot find module
  '...\Temp\openspec-ui-integration-*'`, the fixture workspace path being
  passed to Electron as if it were a JS entry module) — a pre-existing
  environment limitation (no display for a real Electron host in this
  sandboxed session), reproducible with zero relation to this change's
  diff, not something to fix under this change's scope. `npm run test`
  itself (task 6.2's actual gate) does not run `test:integration`, so this
  does not block that check — only this specific assertion's own
  execution remains unverified.
- [x] 4.3 `packages/core/src/harness-chain-runner.test.ts`: with a reader
  returning entries that predate the current process, the budget counts
  them. This is the assertion that proves the fix is end to end rather
  than a file nobody reads.

- [x] 4.4 The integration assertion added for 4.2 fails on CI:
  `ENOENT ... /.openspec-ui/audit.jsonl` (PR #163, "Extension integration
  and package"). It extends the existing "runs a real `status` command"
  test, and `status` is one of four kinds `RunController.run()`
  short-circuits before any runner:
  `if (command.kind === "status" || "list" || "show" || "validate") {
  await this.runDirectOpenSpecCommand(command); return; }`. Those go
  straight to the `openspec` CLI, so **no audit entry is ever recorded for
  them** and the file cannot exist. Move the assertion onto a command kind
  that does reach a runner. A missing agent binary is fine: the
  `"started"` entry is recorded before `execute()` is called, so an entry
  lands even when the spawn then fails. Resolved by review 2026-09-02:
  there is no such command to move it to. No `vscode.commands` entry
  sends a runner-bound kind — `plan`/`implement`/`review` reach a runner
  only through the AI panel's webview — so this suite cannot drive
  `extension.ts`'s audit wiring at all. The assertion is removed and the
  reason recorded in the test itself, rather than left red for a cause
  unrelated to the code's correctness.
- [x] 4.5 That assertion must also **wait** for the file rather than
  reading it once. `record()` is fire-and-forget by design (task 1.1) and
  no `flush()` exists (task 1.6), so a read immediately after the command
  returns can race the queued append — the same trap task 1.5 found in the
  rotation unit test. Size the wait to the work, as 1.5 did. Moot once
  4.4 removed the assertion, and recorded here so the race is not
  reintroduced by whoever next tries to assert on that file.

## 5. Correct the neighbouring change

- [x] 5.1 `openspec/changes/agent-usage-accounting/tasks.md` task 9.6:
  it asks to confirm a real run's audit line carries `agentVersion` and no
  `usage`. Two things are wrong. There was no persisted line to read —
  which this change fixes — and `agentVersion` is **inert**: that change's
  own task 3.1 recorded that wiring an observed version into
  `AgentRunnerOptions` was out of its scope, so the field is always
  `undefined`. Rewrite 9.6 to expect what the code actually produces, and
  say why.
- [x] 5.2 Do **not** implement the `agentVersion` wiring here. It remains
  nobody's task, and this change's scope is persistence. Note it as
  outstanding rather than quietly absorbing it. Confirmed: no host
  (`default-runners.ts`/`server.ts`/`extension.ts`) constructs a runner
  with `agentVersion` set anywhere in this change's diff — `git diff`
  shows none of them touching that option.

## 6. Verification

- [x] 6.1 `openspec change validate --strict audit-log-persistence` and
  `... --strict agent-usage-accounting`.
- [x] 6.2 `npm run typecheck` and `npm run test` — green across all four
  workspaces. See the note at the top of this file.
  `sprint-report.test.ts` and `change-timeline.test.ts` have pre-existing
  Windows timeout flakes at 5000 ms under load; do not attempt to fix them
  here. Reopened 2026-09-02: the full suite fails
  `security.test.ts > FileAuditLog > drops the oldest entries...`, which
  passes 36/36 when that file runs alone — a timing gap, not a flake of
  the documented kind. See tasks 1.5 and 1.6. A suite that is green in
  isolation is not this task being done. Re-reopened same day after task
  1.5's first fix (bare timeout bump) turned out insufficient — see 1.5's
  updated note for the real root cause (an ambiguous wait condition, not
  just a short one) and its actual fix. Confirmed after that fix: `npm run
  typecheck` green across all five workspaces; `npm run test` green across
  all five workspaces (cli 15, core 397, vscode 202, server 60, webui 224
  — 898 tests, 0 failures), reconfirmed over three consecutive full-suite
  runs plus three isolated `@openspec-ui/core` runs, all green.
- [x] 6.3 `git diff` shows **no** change to `AuditEntry`'s fields, to
  `buildUsageReport`, or to `checkBudget`'s logic. This change gives the
  existing record somewhere to live; changing what it records or how it is
  summed means it reached further than it should. Confirmed: `git diff
  packages/core/src/usage-report.ts packages/core/src/harness-chain-
  runner.ts` is empty; `AuditEntry`'s own interface in security.ts is
  untouched (only new code that constructs/reads values of that existing
  type).
- [x] 6.4 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the hosts that gained wiring). `.changeset/audit-log-persistence.md`
  added: `@openspec-ui/core` minor, `@openspec-ui/server`/
  `openspec-ui-vscode` patch. `npx changeset status` confirms
  (`@openspec-ui/webui` minor also listed, automatically, via
  `updateInternalDependents: "always"` in the existing config — not added
  by hand, same mechanism `agent-usage-accounting`'s 9.5 already relied
  on).
- [ ] 6.5 **Human-only, cannot be completed by an implementing agent**:
  run a real stage, close the editor, reopen it, and confirm
  `.openspec-ui/audit.jsonl` still holds that run's entries. Then set a
  small budget on a change, run past it, restart, and confirm the ceiling
  still counts the earlier spend — the behaviour that was silently absent.

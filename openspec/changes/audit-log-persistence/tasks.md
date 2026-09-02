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

- [ ] 1.1 `packages/core/src/security.ts`, `FileAuditLog`: keep
  `record()` returning `void` and swallowing its own errors into
  `console.error`. Do **not** make it awaitable — it is called from inside
  run lifecycles that must not block on disk, and every call site is
  written against the current interface.
- [ ] 1.2 Same class: add a bound with rotation. When exceeded, the
  **oldest** entries are dropped, never the whole file. Truncating on
  overflow would silently hand a change a fresh budget ceiling at an
  arbitrary moment; dropping oldest-first under-counts instead, which is
  the safe direction for a spending cap.
- [ ] 1.3 Same class: state the bound's value **and its arithmetic** in a
  comment — measure one real entry's serialized length and say how many
  runs the bound corresponds to. A number chosen for looking round is what
  this task exists to prevent; `.openspec-ui/workbench-runs.json` reached
  356.6 MB with no bound at all.
- [ ] 1.4 `packages/core/src/security.test.ts`: entries append one line
  each; exceeding the bound drops the oldest and keeps the newest; the
  file is never emptied by rotation.

## 2. Reading back

- [ ] 2.1 `packages/core/src/security.ts`: add a read that returns the
  persisted entries. A missing file yields none — not an error.
- [ ] 2.2 Same read: a line that does not parse is **skipped**, and the
  remaining entries are returned. `record()` is fire-and-forget and can be
  interrupted mid-write, so a torn final line is an expected state rather
  than corruption.
- [ ] 2.3 `packages/core/src/security.test.ts`: a missing file yields no
  entries; a file with a torn final line yields every complete entry
  before it; a well-formed file round-trips what was written.

## 3. Both hosts construct it

- [ ] 3.1 `packages/server/src/server.ts`: construct a `FileAuditLog`
  under the workspace's `.openspec-ui/` directory and pass it as the
  already-declared `auditLog` option. That option exists at line ~62 and
  nothing has ever supplied it.
- [ ] 3.2 `packages/extension`: the same, wherever it builds its runners.
  The extension currently contains no reference to `auditLog` at all, so
  this is the whole of its wiring.
- [ ] 3.3 `packages/core/src/default-runners.ts`: leave
  `config.auditLog ?? new InMemoryAuditLog()` **unchanged**. Core does not
  know where a workspace's state directory is without being told, and
  every existing test relies on that in-memory default — changing it would
  make tests that construct runners start writing files.
- [ ] 3.4 Both hosts: pass a reader for the same file as
  `HarnessChainRunner`'s optional `listAuditEntries`, so the budget sums
  persisted history. Without this the entries persist and the budget still
  reads one session — the defect only half fixed.

## 4. Tests

- [ ] 4.1 `packages/server`: a run recorded through the server's runners
  appears in the audit file, and a second server instance over the same
  workspace reads it back.
- [ ] 4.2 `packages/extension`: its runner construction supplies both the
  log and the reader — assert both, since supplying only the log leaves
  the budget reading nothing.
- [ ] 4.3 `packages/core/src/harness-chain-runner.test.ts`: with a reader
  returning entries that predate the current process, the budget counts
  them. This is the assertion that proves the fix is end to end rather
  than a file nobody reads.

## 5. Correct the neighbouring change

- [ ] 5.1 `openspec/changes/agent-usage-accounting/tasks.md` task 9.6:
  it asks to confirm a real run's audit line carries `agentVersion` and no
  `usage`. Two things are wrong. There was no persisted line to read —
  which this change fixes — and `agentVersion` is **inert**: that change's
  own task 3.1 recorded that wiring an observed version into
  `AgentRunnerOptions` was out of its scope, so the field is always
  `undefined`. Rewrite 9.6 to expect what the code actually produces, and
  say why.
- [ ] 5.2 Do **not** implement the `agentVersion` wiring here. It remains
  nobody's task, and this change's scope is persistence. Note it as
  outstanding rather than quietly absorbing it.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict audit-log-persistence` and
  `... --strict agent-usage-accounting`.
- [ ] 6.2 `npm run typecheck` and `npm run test` — green across all four
  workspaces. See the note at the top of this file.
  `sprint-report.test.ts` and `change-timeline.test.ts` have pre-existing
  Windows timeout flakes at 5000 ms under load; do not attempt to fix them
  here.
- [ ] 6.3 `git diff` shows **no** change to `AuditEntry`'s fields, to
  `buildUsageReport`, or to `checkBudget`'s logic. This change gives the
  existing record somewhere to live; changing what it records or how it is
  summed means it reached further than it should.
- [ ] 6.4 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the hosts that gained wiring).
- [ ] 6.5 **Human-only, cannot be completed by an implementing agent**:
  run a real stage, close the editor, reopen it, and confirm
  `.openspec-ui/audit.jsonl` still holds that run's entries. Then set a
  small budget on a change, run past it, restart, and confirm the ceiling
  still counts the earlier spend — the behaviour that was silently absent.

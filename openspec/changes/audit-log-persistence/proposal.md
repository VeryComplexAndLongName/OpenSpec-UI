## Why

Found on 2026-09-02, while trying to perform `agent-usage-accounting`'s
own human-only verification (its task 9.6: read a real run's audit line):
there is no audit line to read. Nothing in either delivery target
persists the audit log.

```ts
// packages/core/src/default-runners.ts:72
const auditLog = config.auditLog ?? new InMemoryAuditLog();
```

`packages/server/src/server.ts:62` declares an optional
`auditLog?: AuditLog` and nothing ever passes one. `packages/extension`
contains no reference to `auditLog` at all. `FileAuditLog` appears only in
`security.test.ts`. Both hosts therefore fall through to the in-memory
implementation, and every entry is discarded when the host exits.

`agent-usage-accounting`'s proposal stated that *"`FileAuditLog` already
serializes entries as JSONL, so persistence follows with no new
mechanism."* That is true of the class and false of the system: the class
was never instantiated outside tests. The gap was in that change's task
list, which added fields to `AuditEntry` and a report over them without a
task that gives them somewhere to live.

What that costs, in increasing order:

- Its task 9.6 cannot be performed at all.
- `usage`, `agentVersion` and `changeDir` are recorded and then lost.
- `buildUsageReport()`'s totals "by agent, by model and by change" cover
  only the current editor session, not a change's history.
- **The budget silently resets on every restart.** `HarnessChainRunner`'s
  `checkBudget` sums recorded usage through `listAuditEntries`, which
  reads the same in-memory log. A ceiling meant to stop runaway spend
  forgets everything spent as soon as the editor is closed.

The record shape, the report and the budget logic are all correct and
tested. One wiring step is missing.

## What Changes

- `packages/server/src/server.ts` and `packages/extension`: both hosts
  construct a `FileAuditLog` under the workspace's `.openspec-ui/`
  directory and pass it to the runners they build, instead of letting
  `default-runners.ts` fall back to the in-memory implementation.
- `packages/core/src/security.ts`: `FileAuditLog` gains bounded retention.
  An append-only file with no bound is exactly how
  `.openspec-ui/workbench-runs.json` reached 356.6 MB, and that lesson is
  three days old.
- `packages/core`: a way to read entries back, so
  `HarnessChainRunner`'s existing optional `listAuditEntries` dependency
  can be satisfied with the persisted history rather than one session's.
- `openspec/changes/agent-usage-accounting/tasks.md` task 9.6: corrected.
  It currently asks for something that cannot exist, and it also expects
  `agentVersion` to be present when that change's own task 3.1 recorded
  the wiring as deliberately out of scope.

## Capabilities

### New Capabilities

(none — this extends `execution-core`)

### Modified Capabilities

- `execution-core`: the audit record survives a host restart, is bounded
  in size, and can be read back.

## Impact

- `packages/core/src/security.ts`; `packages/server/src/server.ts`;
  `packages/extension`'s runner construction.
- A new `.openspec-ui/audit.jsonl` (name is a design decision) in each
  workspace where a run happens.
- No change to `AuditEntry`'s shape, to what is recorded, to the
  report, or to the budget's logic — only to whether the entries outlive
  the process.

## Explicitly out of scope

- Changing what is audited. `agent-usage-accounting` settled the shape.
- Surfacing the persisted history in either UI. `buildUsageReport()`
  exists and has no consumer yet; giving it one is separate work with its
  own presentation decisions.
- Wiring an observed agent version into `AgentRunnerOptions.agentVersion`
  — still inert, per `agent-usage-accounting` task 3.1's own note, and
  still nobody's task. This change only stops task 9.6 from asserting
  otherwise.

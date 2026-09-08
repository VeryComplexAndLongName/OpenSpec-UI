Two halves that only look separate: a ceiling on a stage is worth little
if nothing afterwards can say which stage spent what, and a record broken
down by stage is what the report and the recommendation both need.

## 1. The record

- [ ] 1.1 `stage` and `effort` on `AuditEntry`, both optional, for the
  same reason `changeDir` and `usage` are: an entry written before them
  is still valid, and "not recorded" has to be distinguishable from "no
  stage".
- [ ] 1.2 The chain records the stage, because only it knows one. Do not
  thread a stage through `Command` into `agent-runner.ts` — that runner
  serves single-stage runs too, where the field would be meaningless for
  every caller.
- [ ] 1.3 A single-stage run carries no stage, and is not given one.
- [ ] 1.4 Never infer a stage for an entry that has none. A guess from
  timestamps would sometimes be wrong, and a report that invented an
  attribution is worse than one that says the older entries cannot be
  broken down.
- [ ] 1.5 Record `effort` as the agent was asked for it, not as the agent
  reported it — the ask is what a later recommendation would repeat.

## 2. The cut, finishing what was deferred

- [ ] 2.1 A run stopped by a ceiling carries the reason in its record.
  This is `run-has-a-time-limit`'s task 3.4, deferred to here because an
  entry with no stage could not be attributed to one.
- [ ] 2.2 Do not write a second entry. `agent-runner.ts` already records
  a cancelled outcome when the process is terminated; the reason goes
  onto that outcome, so a report never sees the same run twice.

## 3. The ceiling

- [ ] 3.1 An optional per-stage spending ceiling on `HarnessConfig`,
  enforced by this project.
- [ ] 3.2 Evaluated when a stage ends, against what that stage reported,
  and stopping the chain rather than the stage. Say so where it is
  defined: the name suggests it caps the stage, and it cannot — a run's
  cost is not known until it ends.
- [ ] 3.3 Keep passing `stepAgents.<stage>.budget` to the agent's own CLI
  untouched. Where an agent's command line can cap an invocation that cap
  is better than this one, because it acts during the run; this exists
  for the agents that have none.
- [ ] 3.4 Name the ceiling and its value when it stops the chain, not the
  stage that reached it.
- [ ] 3.5 An agent that reports nothing has nothing to compare, so the
  ceiling does not fire. State it plainly — that is exactly the case the
  time ceiling covers, and a reader who thinks this bounds a silent agent
  will be wrong.

## 4. Tests

- [ ] 4.1 A completed chain stage's record names its stage and effort.
- [ ] 4.2 A single-stage run's record carries neither.
- [ ] 4.3 A stage over its ceiling stops the chain, and the reason names
  the ceiling and the value.
- [ ] 4.4 A stage whose agent reported nothing does not stop the chain.
- [ ] 4.5 A cut records its reason, and exactly one record exists for
  that run — asserted by counting, since double-recording is the failure
  this shape was chosen to avoid.
- [ ] 4.6 An entry with no stage is read back as having none, rather than
  being attributed.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict stage-spend-is-bounded-and-recorded`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 5.3 Version bump via `npx changeset` for `@openspec-ui/core`.
- [ ] 5.4 `LIMITS.md`: the new ceiling, what it can and cannot do, and
  that it is checked when a stage ends. Keep the existing statement that
  a spending ceiling never interrupts a running stage — this one does not
  change that, and a reader must not conclude otherwise from its name.
- [ ] 5.5 **Human-only**: run a chain and read the audit log, confirming
  each stage's entry names its stage and effort, and that a run cut by a
  time ceiling carries the reason exactly once.

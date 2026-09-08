Two halves that only look separate: a ceiling on a stage is worth little
if nothing afterwards can say which stage spent what, and a record broken
down by stage is what the report and the recommendation both need.

## 1. The record

- [x] 1.1 `stage` and `effort` on `AuditEntry`, both optional, for the
  same reason `changeDir` and `usage` are: an entry written before them
  is still valid, and "not recorded" has to be distinguishable from "no
  stage".
- [x] 1.2 The stage travels on `Command`, set by the chain beside
  `model`/`effort`/`budget` — which the chain already sets there, and one
  of which (`effort`) this change also needed recorded.
  **This task originally said the opposite**: not to thread a stage
  through `Command`, on the grounds that the runner serves single-stage
  runs where the field would be meaningless. Reading the code reversed
  it. Three optional fields set by the chain already travel that way, and
  the alternative — the chain amending the entry the runner wrote —
  cannot be built without an update operation on `AuditLog`, which is
  append-only. The original wording is kept here rather than replaced, so
  the record shows the decision changed and why.
- [x] 1.3 A single-stage run carries no stage, and is not given one.
- [x] 1.4 Never infer a stage for an entry that has none. A guess from
  timestamps would sometimes be wrong, and a report that invented an
  attribution is worse than one that says the older entries cannot be
  broken down.
- [x] 1.5 Record `effort` as the agent was asked for it, not as the agent
  reported it — the ask is what a later recommendation would repeat.

## 2. The cut, finishing what was deferred

- [x] 2.1 A run stopped by a ceiling carries the reason in its record.
  This is `run-has-a-time-limit`'s task 3.4, deferred to here because an
  entry with no stage could not be attributed to one.
- [x] 2.2 Do not write a second entry. `agent-runner.ts` already records
  a cancelled outcome when the process is terminated; the reason goes
  onto that outcome, so a report never sees the same run twice.

## 3. The ceiling

- [x] 3.1 An optional per-stage spending ceiling on `HarnessConfig`,
  enforced by this project.
- [x] 3.2 Evaluated when a stage ends, against what that stage reported,
  and stopping the chain rather than the stage. Said where it is defined —
  in `HarnessBudget`'s own doc comment and in LIMITS.md — because the name
  suggests it caps the stage, and a run's cost is not known until it ends.
- [x] 3.3 Keep passing `stepAgents.<stage>.budget` to the agent's own CLI
  untouched. Where an agent's command line can cap an invocation that cap
  is better than this one, because it acts during the run; this exists
  for the agents that have none.
- [x] 3.4 Name the ceiling and its value when it stops the chain, not the
  stage that reached it.
- [x] 3.5 An agent that reports nothing has nothing to compare, so the
  ceiling does not fire. State it plainly — that is exactly the case the
  time ceiling covers, and a reader who thinks this bounds a silent agent
  will be wrong.

## 4. Tests

- [x] 4.1 A completed chain stage's record names its stage and effort.
- [x] 4.2 A single-stage run's record carries neither.
- [x] 4.3 A stage over its ceiling stops the chain, and the reason names
  the ceiling and the value.
- [x] 4.4 A stage whose agent reported nothing does not stop the chain.
- [x] 4.5 A cut records its reason, and exactly one record exists for
  that run — asserted by counting entries with a cancelled outcome, since
  double-recording is the failure this shape was chosen to avoid.
- [x] 4.6 An entry with no stage is read back as having none, rather than
  being attributed.

## 5. Verification

- [x] 5.1 `openspec change validate --strict stage-spend-is-bounded-and-recorded`.
  Run 2026-09-08: "Change 'stage-spend-is-bounded-and-recorded' is valid".
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 624 core,
  280 extension, 62 server, 265 webui — core up 6 for the cases added
  here.
- [x] 5.3 Version bump via `npx changeset` for `@openspec-ui/core`.
  Done: `.changeset/stage-spend-is-bounded-and-recorded.md`.
- [x] 5.4 `LIMITS.md`: the new ceiling, what it can and cannot do, and
  that it is checked when a stage ends. Keep the existing statement that
  a spending ceiling never interrupts a running stage — this one does not
  change that, and a reader must not conclude otherwise from its name.
- [ ] 5.5 **Human-only**: run a chain and read the audit log, confirming
  each stage's entry names its stage and effort, and that a run cut by a
  time ceiling carries the reason exactly once.

## 6. What the live run found

Task 5.5 could not be closed, and the reason was inside this change. Run
on 2026-09-08 with `timeout.maxStageSeconds: 5`: the panel showed
`verify (claude-cli)` at effort `low`, the stage was cut, and both audit
entries carried `stage: "verify"` and `effort: "low"` — those halves
work. The cancelled entry carried no reason.

The requirement in section 5's spec delta says a run stopped at a ceiling
records that reason "so that a stopped run can be told from one a person
cancelled without inspecting anything else". It was not met. The panel
had the reason because the chain yields its own `cancelled` event; the
adapter that ends the run knows only that its signal aborted, so the
entry it triggers had nothing to write.

- [x] 6.1 The cancel command carries the reason. `Command.reason` is set
  only where something other than a person caused the cancel — the chain
  sets `state.cancelReason` before every ceiling's `cancel()` and leaves
  it unset for a person's, which is exactly the distinction the record
  needs.
- [x] 6.2 The runner keeps it with the run's abort controller, because
  the run that must record it is a different `run()` call from the one
  that cancels it, and the entry is written by the original invocation.
  Stored before aborting, so the `finally` cannot run first.
- [x] 6.3 An adapter that does supply its own reason keeps it. It was
  closer to the event.
- [x] 6.4 A person's cancel still records no reason. An absent reason has
  always meant "a person asked", and this preserves that rather than
  erasing it.
- [x] 6.5 Tests: a ceiling's reason reaches the entry, exactly once; a
  person's cancel leaves it absent. Removing the carry fails the first
  and leaves the second passing, which is what shows the two are being
  told apart rather than both being filled in.
- [x] 6.6 Re-run the checks. Run 2026-09-08 on an idle machine:
  typecheck clean; lint clean apart from one warning that predates this
  change (`killTimer` unused in `packages/core/src/agents/shared.ts:210`);
  tests 48 cli, 687 core, 285 extension, 62 server, 276 webui — core up 2.
- [ ] 6.7 **Human-only**: this is task 5.5. Cut a stage at a time ceiling
  again and read `.openspec-ui/audit.jsonl` — the cancelled entry should
  now name the ceiling and its value, and there should still be exactly
  one terminal entry for that run.

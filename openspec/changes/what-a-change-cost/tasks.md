Everything this needs is already written down: the audit log keeps a
`started` and a terminal entry per run, both now carrying `stage` and
`effort`, and it survives a restart. The work is reading it back honestly.

## 1. Reading the records

- [ ] 1.1 A core function taking a workspace root and a change, returning
  the structure a host renders. Core produces, the host displays — ADR
  0001, and it also means the later recommendation reads this function
  rather than a second implementation that drifts from it.
- [ ] 1.2 Group by stage. Every stage of a chain shares the chain's
  `runId`, so `stage` is the only thing that separates them.
- [ ] 1.3 Derive duration from the `started` and terminal entries rather
  than adding a timing field — both are already written and timestamped.
- [ ] 1.4 Pair them in order, per `runId` and `stage`. A stage that was
  attempted twice has two of each, and pairing by key alone would take
  the wrong end time.
- [ ] 1.5 An unpaired `started` — a run that never ended because the
  editor closed — is reported as still running, not given an end time it
  never had.

## 2. Saying what is not known

- [ ] 2.1 A figure the agent did not report shows as "not reported".
  Never zero: six of the ten supported agents report nothing, and this
  project already refused `$0.00` for them once, in the live panel.
- [ ] 2.2 A total is described as covering only what was reported.
  Summing the reported figures and calling the result the change's cost
  would quietly claim the silent stages were free.
- [ ] 2.3 A record with no stage appears as unattributed and still counts
  toward the total. Dropping it makes the total wrong; folding it into a
  guessed stage makes a row wrong.
- [ ] 2.4 Do not derive cost from tokens. ADR 0017 rejected local price
  tables: silently wrong at the next price change, in a direction nobody
  notices.

## 3. Reaching it

- [ ] 3.1 A command on a change in both the Changes and Archive trees,
  with no condition on the change's state.
- [ ] 3.2 A change nothing has run against reports that, rather than an
  empty table — the same distinction between "nothing" and "no data" the
  rest of this surface makes.
- [ ] 3.3 Render the first version in the extension. The structure is
  what this change fixes; a different surface later reads the same
  function.

## 4. Tests

- [ ] 4.1 A completed chain's records produce a row per stage with agent,
  effort, spend and duration.
- [ ] 4.2 A stage that ran twice produces two rows, each with its own
  duration — the pairing case that a key-only match gets wrong.
- [ ] 4.3 An agent that reported nothing produces "not reported", and the
  total says what it covers.
- [ ] 4.4 A record with no stage appears as unattributed and is counted.
- [ ] 4.5 An unpaired `started` is reported as still running.
- [ ] 4.6 A change with no records reports that nothing has run.
- [ ] 4.7 A cut run's report says how it ended, carrying the reason the
  record holds.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict what-a-change-cost`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 5.3 Version bump via `npx changeset` for `@openspec-ui/core` and
  `openspec-ui-vscode`.
- [ ] 5.4 Run it against this repository's own `.openspec-ui/audit.jsonl`
  and record what it produces. This log holds real runs from several
  agents, including ones that reported nothing and records written before
  `stage` existed — the mixture the report has to handle, and one that no
  fixture would have thought to contain.
- [ ] 5.5 **Human-only**: open the report on a change that finished and
  on one that did not, and confirm both read correctly — in particular
  that a stage with no reported figure reads as unknown rather than free.

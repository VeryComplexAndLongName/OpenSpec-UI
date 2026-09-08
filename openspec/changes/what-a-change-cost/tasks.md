Everything this needs is already written down: the audit log keeps a
`started` and a terminal entry per run, both now carrying `stage` and
`effort`, and it survives a restart. The work is reading it back honestly.

## 1. Reading the records

- [x] 1.1 A core function taking a workspace root and a change, returning
  the structure a host renders. Core produces, the host displays — ADR
  0001, and it also means the later recommendation reads this function
  rather than a second implementation that drifts from it.
- [x] 1.2 Group by stage. Every stage of a chain shares the chain's
  `runId`, so `stage` is the only thing that separates them.
- [x] 1.3 Derive duration from the `started` and terminal entries rather
  than adding a timing field — both are already written and timestamped.
- [x] 1.4 Pair them in order, per `runId` and `stage`. A stage that was
  attempted twice has two of each, and pairing by key alone would take
  the wrong end time.
  Covered by a test with two attempts of the same stage under one
  `runId`, which is the case a key-only match gets wrong.
- [x] 1.5 An unpaired `started` — a run that never ended because the
  editor closed — is reported as still running, not given an end time it
  never had.

## 2. Saying what is not known

- [x] 2.1 A figure the agent did not report shows as "not reported".
  Never zero: six of the ten supported agents report nothing, and this
  project already refused `$0.00` for them once, in the live panel.
  Asserted both ways: the string is present and `$0.00` is absent.
- [x] 2.2 A total is described as covering only what was reported.
  Summing the reported figures and calling the result the change's cost
  would quietly claim the silent stages were free.
- [x] 2.3 A record with no stage appears as unattributed and still counts
  toward the total. Dropping it makes the total wrong; folding it into a
  guessed stage makes a row wrong.
- [x] 2.4 Do not derive cost from tokens. ADR 0017 rejected local price
  tables: silently wrong at the next price change, in a direction nobody
  notices.

## 3. Reaching it

- [x] 3.1 A command on a change in both the Changes and Archive trees,
  with no condition on the change's state.
- [x] 3.2 A change nothing has run against reports that, rather than an
  empty table — the same distinction between "nothing" and "no data" the
  rest of this surface makes.
- [x] 3.3 Render the first version in the extension. The structure is
  what this change fixes; a different surface later reads the same
  function.

## 4. Tests

- [x] 4.1 A completed chain's records produce a row per stage with agent,
  effort, spend and duration.
- [x] 4.2 A stage that ran twice produces two rows, each with its own
  duration — the pairing case that a key-only match gets wrong.
- [x] 4.3 An agent that reported nothing produces "not reported", and the
  total says what it covers.
- [x] 4.4 A record with no stage appears as unattributed and is counted.
- [x] 4.5 An unpaired `started` is reported as still running.
- [x] 4.6 A change with no records reports that nothing has run.
- [x] 4.7 A cut run's report says how it ended, carrying the reason the
  record holds.

## 5. Verification

- [x] 5.1 `openspec change validate --strict what-a-change-cost`.
  Run 2026-09-08: "Change 'what-a-change-cost' is valid".
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 637 core,
  285 extension, 62 server, 265 webui — core up 8 and the extension up 5
  for the cases added here.
- [x] 5.3 Version bump via `npx changeset` for `@openspec-ui/core` and
  `openspec-ui-vscode`.
  Done: `.changeset/what-a-change-cost.md`.
- [x] 5.4 Run it against this repository's own `.openspec-ui/audit.jsonl`
  and record what it produces. This log holds real runs from several
  agents, including ones that reported nothing and records written before
  `stage` existed — the mixture the report has to handle, and one that no
  fixture would have thought to contain.
  Run 2026-09-08 against this repository's own log: 82 entries across 20
  changes, producing 41 rows.

  - **41 of 41 rows are unattributed.** Every record predates the `stage`
    field, which landed hours ago. Exactly the case task 2.3 exists for,
    and the first evidence that dropping them would have emptied the
    report entirely rather than merely thinning it.
  - **22 rows reported nothing at all**, 16 carried a cost and 19 carried
    tokens — the mixture no fixture would have thought to contain, from
    three agents (`claude-cli`, `claude-cli-acp`, `copilot-cli-acp`).
  - Durations came out plausible on inspection (a 20-minute `claude-cli`
    run, a 56-minute one), and no row was left "still running".

  The `copilot-cli-acp` case shows the honesty rule doing real work: it
  reports tokens and no cost, so that change's report reads
  `cost=not reported, in=786966` rather than a total implying it was free.
- [ ] 5.5 **Human-only**: open the report on a change that finished and
  on one that did not, and confirm both read correctly — in particular
  that a stage with no reported figure reads as unknown rather than free.

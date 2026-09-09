Measured 2026-09-09 on this repository's log: 108 entries, 80 against a
change that still exists, 40 paired runs, 16 with a cost — and **effort
known for one run in forty**, because the field landed two days ago.

## 1. What is counted

- [x] 1.1 Pair each `started` with the next unclaimed terminal entry
  sharing its `runId` and `stage`, in order — the same rule
  `buildChangeCostReport` uses, because a chain that returned from
  `verify` to `apply` has two of each and matching on the key alone takes
  the wrong end time.
- [x] 1.2 Exclude runs against a change that is neither active nor
  archived. No marker: a finished change is in the archive, a live one is
  in `changes/`, and one in neither was deleted.
- [x] 1.3 The caller supplies which changes exist. This module reads no
  files, like every other analysis in core.

## 2. What is reported

- [x] 2.1 Per agent, and per agent and effort together.
- [x] 2.2 Each group carries its run count, its completed count, and how
  many runs reported a cost — separately, because an agent that reports
  nothing has runs and no costs, and the two counts are what say so.
- [x] 2.3 Median and p90 for cost and for duration, over the samples that
  have them.
- [x] 2.4 A group below the threshold is reported as below it, with how
  many it has and how many are needed. Omitting it would make "too little
  is known" look like "never run".
- [x] 2.5 Threshold of five, stated in one place and reported alongside
  the groups rather than left implicit.

## 3. Tests

- [x] 3.1 A change that is neither active nor archived contributes
  nothing.
- [x] 3.2 An archived change contributes, including when the audit entry
  records the path it had before archiving.
- [x] 3.3 A group with four runs is reported as below the threshold; with
  five it is not.
- [x] 3.4 An agent that reports no cost has a run count and a cost-sample
  count of zero, and no median cost — not a median of zero.
- [x] 3.5 The pairing survives a stage that ran twice under one `runId`.
- [x] 3.6 Run it over this repository's real log and record what it says.
  A function that answers the same thing for every group is not reading
  anything.
  Run 2026-09-09 over `.openspec-ui/audit.jsonl`: 108 entries, 28 from
  changes that no longer exist, 40 paired runs, effort known for 1.

      claude-cli-acp   18 runs  16 done  16 costs  med $1.88  p90 $7.14  7.7 min
      copilot-cli-acp  12 runs   7 done   0 costs         —          —  5.9 min
      claude-cli       10 runs  10 done   0 costs         —          —  18.9 min
      claude-cli-acp/high  1 run, below the threshold

  It differentiates, and what it says is worth knowing: `claude-cli` runs
  2.4 times as long as its ACP variant, and `copilot-cli-acp` reports no
  cost at all across twelve runs — so a spending ceiling over it cannot
  act, which is exactly what the diagnostic says on its own and this now
  says with a number behind it.

  The 28 excluded entries are the three disposable smoke changes and two
  live probes, all deleted. No real change was dropped.

## 4. Verification

- [x] 4.1 `openspec change validate --strict what-runs-cost-here`.
  Run 2026-09-09: valid.
- [x] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine.
  Run 2026-09-09 on an idle machine: typecheck clean; lint clean with no
  warnings. Tests 48 cli, 726 core, 304 extension, 62 server, 296 webui
  — core up 9.

  One test caught a slip of my own rather than a defect: it asserted a
  median where it meant to assert pairing, and with two samples the
  nearest-rank median is the lower one, so it would have passed even if
  both runs had been paired to the same end time. Rewritten to assert p90
  as well, which is the figure that can only be right if each `started`
  found its own terminal entry.
- [x] 4.3 Version bump via `npx changeset` for `core`.
  Done: `.changeset/what-runs-cost-here.md`.

Measured before built: 0 of 108 audit entries carry `checksRan` on this
repository, because no chain has verified since the recording landed.
This ships showing nothing and saying which nothing it is.

## 1. The figures

- [x] 1.1 Per agent: verifying stages, how many found something, checks
  run and checks failed.
- [x] 1.2 The same deleted-change exclusion as the cost figures, from a
  function both call rather than two copies of the rule.
- [x] 1.3 A threshold of five, stated with the figure, and a thin group
  reported rather than dropped.
- [x] 1.4 Counts, not names: the entry records how many checks failed,
  not which. An earlier draft carried names the field cannot supply.

## 2. The surface

- [x] 2.1 Returned by the route that already reads the log, not by a
  second one reading it again.
- [x] 2.2 Rendered beside the cost figures, in the panel that already
  shows them.
- [x] 2.3 Three empty states, not one: nothing logged, nothing verified,
  or figures.

## 3. Tests

- [x] 3.1 Stages, failures and check counts per agent.
- [x] 3.2 A thin group is marked thin; a group at the threshold is not.
- [x] 3.3 An entry that never verified is ignored rather than counted as
  a clean one.
- [x] 3.4 A run against a deleted change is excluded.
- [x] 3.5 The two empty states read differently.
- [x] 3.6 A host that did not read quality renders no quality block —
  an empty one would claim every verify passed.

## 4. Verification

- [x] 4.1 `openspec validate --strict --changes`.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-10: exit 0 — 48 cli, 823 core, 308 extension, 70 server,
  346 webui. Two of this repository's own checks earned their keep on the
  way: the test-budget check refused a filesystem test with no measured
  ceiling, and the bundle-safety test refused a value exported from a
  module that reads files.
- [x] 4.3 Version bump via `npx changeset`.
- [x] 4.4 Run it against this repository's own log and record what it
  says — which, today, should be "nothing verified yet".

  Run 2026-09-10 over `.openspec-ui/audit.jsonl`: 108 entries, 0 carrying
  `checksRan`. The surface reads "Nothing to report yet — 108 runs
  recorded, none of which reached a verifying stage that reported what
  its checks found." That is the honest answer and the reason this was
  built now rather than after the first figure appeared.

`main` went red on the commit that emptied the change queue. Nothing was
broken; a guard against checking nothing cannot tell an empty subject
from a broken reach.

## 1. The guard

- [x] 1.1 `packages/core/src/spec-delta-check.test.ts`: the non-vacuity
  assertion on `deltaSpecs.length` runs only when the workspace has at
  least one active change. The drift check itself still runs and is
  still asserted to find nothing, whatever the count.
- [x] 1.2 Record in the test why, so the next reader does not restore
  the unconditional form: an empty queue is a state this repository
  reaches by finishing its work.

## 2. The empty case, proved over a fixture

- [x] 2.1 A test over a workspace with `openspec/changes/` present and
  no change in it: `checkSpecDeltaDrift` returns an empty list and does
  not throw. This is what covers the state the repository-level test
  cannot, because this change is itself an active change.
  `spec-delta-check.test.ts`, "a workspace with no active change" —
  "finds no drift, and does not mistake having nothing to read for a
  fault".

## 3. Verification

- [x] 3.1 `openspec validate --strict --changes`. Exit 0.
- [x] 3.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Recorded below.
- [x] 3.3 Confirm the repository-level test still fails when drift is
  real: introduce drift in a scratch copy, not in this tree, and say
  what was seen.

  Done in this tree with the file copied aside first and restored after,
  rather than in a separate clone — the check reads the workspace it
  runs in, so a copy would have had to be a full one.

  The first attempt injected the wrong kind of drift and proved nothing:
  I changed a sentence of prose in the modified block and the suite
  stayed green. That is correct behaviour, not a miss —
  `checkSpecDeltaAgainstSpec` compares requirement headers and
  scenarios, never prose. Recorded because a confirmation that rests on
  the wrong injection is worse than none.

  The second attempt dropped `#### Scenario: A developer with commit
  signing on` from this change's own modified block. The suite failed
  with: `scenario "A developer with commit signing on" under requirement
  "A passing check has checked what its name says" exists in the current
  specification but is omitted from this change's modified block`.
  Restored, and green again.

- [x] 3.4 No changeset: a test-only change publishes nothing.

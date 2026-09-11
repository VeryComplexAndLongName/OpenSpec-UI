# An empty queue is not a failure

## Why

`main` went red on 2026-09-11, on the commit that archived the last
seven changes. Nothing was broken by that commit. The suite failed
because the repository reached a state no test allowed for: no active
change at all.

`packages/core/src/spec-delta-check.test.ts:185` asserts
`expect(deltaSpecs.length).toBeGreaterThan(0)` before checking the
active changes for spec-delta drift. The guard is right in intent — a
clean result that is clean only because the check reached nothing would
read as "no drift" forever, and a spec id that stopped resolving to a
file is exactly how that happens. The comment records the measurement it
was written against: five delta specs across the active changes.

But "the check reached nothing because resolution broke" and "the check
reached nothing because there is nothing in flight" are different facts,
and the guard cannot tell them apart. Finishing all the work in the
queue is a good day, not a regression, and it should not turn the build
red.

This is the inverse of the defect `a-check-that-passes-checked-something`
closed. That one was about a check that passes without checking; this is
a check that fails without having anything to check.

## Capabilities

### Modified

- A check that guards against reaching nothing distinguishes an empty
  subject from a broken reach, and fails only for the second.

## Out of scope

The drift check itself. It is correct, and it stays exactly as strict
whenever there is an active change to run it over.

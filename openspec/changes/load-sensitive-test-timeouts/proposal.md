## Why

`git-fixture-test-cost` took the full local `npm run test` from eight
failures in three files to one failure in one file. The one left is not a
git fixture:

```
FAIL src/harness-chain-runner.test.ts > HarnessChainRunner — semi-autonomous
     > confirming a checkpoint resumes into the next stage's agent
AssertionError: expected { kind: 'started', …(4) } to match object { kind: 'completed' }
```

It passes alone, 27/27, and fails inside the full run. The cause is a
ceiling nobody chose: `vi.waitFor` defaults to **1000 ms**, and that test
drives four chain stages — each writing real files and resolving real
configuration — before the `completed` event it waits for. On an idle
machine four stages fit inside a second; under co-load they do not, and
the assertion reads the last event so far, which is `started`.

Nothing is wrong with the code under test. The test asserts a real
sequence and the sequence happens; the test simply stops watching too
early. That distinction matters, because a failure that looks like a
product bug and is not costs an investigation every time someone sees it,
and — worse — trains people to read a red suite as noise. This repository
has already paid that price once: `npm run lint` was expected-red for
days, and a real eslint error passed unread until CI caught it.

The remaining defect is small and specific, which is exactly why it is
worth closing rather than living with. A suite that is green only on an
idle machine cannot be the gate before a commit, and this repository's own
`operations.apply.guidance` requires that gate.

## What Changes

- `packages/core/src/harness-chain-runner.test.ts`: every `vi.waitFor`
  that waits on a multi-stage chain gets an explicit timeout sized against
  what it actually waits for, with the measurement recorded — the same
  discipline `ci-job-timeouts` and `git-fixture-test-cost` used, where a
  ceiling exists to detect a hang and should be wrong in the cheap
  direction.
- Any other `vi.waitFor` in `packages/core` waiting on comparable work
  gets the same treatment, found by inspection rather than by waiting for
  it to fail.
- The default is not raised globally: a suite-wide ceiling would hide the
  same problem everywhere, including in tests that have no excuse for it.

## Capabilities

### New Capabilities

(none — test-only)

### Modified Capabilities

(none — no behavior change)

## Impact

- `packages/core/src/harness-chain-runner.test.ts`, plus any sibling test
  found to share the pattern. No `packages/*/src` non-test file changes,
  and therefore no changeset — the precedent is
  `openspec/changes/archive/2026-09-01-ci-job-timeouts/`.

## Explicitly out of scope

- Making the chain runner itself faster. Nothing indicates it is slow;
  the test's watch window is what is mis-sized.
- Reducing test co-load, or serializing vitest. Tests that only pass when
  nothing else runs are the condition being removed, not the remedy.
- The two git-fixture files. `git-fixture-test-cost` owns those and has
  already fixed them.

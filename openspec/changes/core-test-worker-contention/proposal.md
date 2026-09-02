## Why

`npm run test` is red on this machine again, and this time raising a
ceiling does not help.

`packages/core/src/git.push.test.ts` takes **2.6 s** when it runs alone
and **hangs past 20 s** when one other test file runs beside it. The same
two files pass together in 7.7 s with
`--pool=forks --poolOptions.forks.singleFork=true`. So the cause is not
duration: it is contention between vitest's parallel workers over real
`git` subprocesses and temporary directories on Windows. A timeout only
changes which number the failure reports.

This has been misdiagnosed twice already, in this repository's own task
notes. `harness-config-top-level-keys` task 3.2 recorded two failures as
"pre-existing co-load timeout flakiness already tracked by the open
`load-sensitive-test-timeouts` change". `acp-agent-capabilities` task 3.2
recorded the same two, and worked around them by passing
`--pool=forks --poolOptions.forks.singleFork=true` by hand for that run.
Both notes are honest about what was seen; neither is right about the
cause, and the second contains the fix without naming it as one.

`load-sensitive-test-timeouts` fixed a different thing well: watch
windows that were too short. Its ceilings are measured and its reasoning
holds. It is not the tracking issue for this, and leaving this filed
under it is how a wrong diagnosis becomes the accepted one.

The cost is the same one this repository has paid before: a suite that is
red for a reason nobody trusts stops being read. `npm run lint` was
expected-red for days and a real eslint error passed unread. The two
files failing today are a real push against a real bare remote and the
parser check over every `tasks.md` in the repository — the two tests most
likely to catch something, and the two currently easiest to dismiss.

## What Changes

- Establish what actually contends. `git.push.test.ts` builds a bare
  remote, a clone, a commit and a push — around eight `git` processes
  against temporary directories. Whether the blocker is process spawning,
  the temp directory, or `simple-git`'s own handling is the first thing
  to find out, and the change should not guess.
- Fix it where it belongs. If the answer is that files spawning real
  subprocesses cannot share a worker pool on Windows, that is a vitest
  configuration decision for `packages/core`, recorded once with its
  reason — not a flag pasted into a command line whenever someone
  remembers.
- Correct the two task notes that recorded this as a timeout, so the
  record says what was actually true.

## Capabilities

### New Capabilities

(none — test infrastructure)

### Modified Capabilities

(none — no product behavior changes)

## Impact

- `packages/core/vitest.config.ts`, possibly `git.push.test.ts`.
- The task notes in `harness-config-top-level-keys` and
  `acp-agent-capabilities` that name the wrong cause.
- No `packages/*/src` non-test source changes.

## Explicitly out of scope

- Reverting anything `load-sensitive-test-timeouts` did. Its ceilings are
  measured and correct for what they cover.
- Making the tests stop using real `git`. These exist to exercise real
  `git` output; a mocked push proves nothing about a branch with no
  upstream, which is the defect the file was written for.
- CI. The Linux runner passes this suite consistently; this is a Windows
  developer-machine problem, which is exactly why it must not be left to
  "run it again".

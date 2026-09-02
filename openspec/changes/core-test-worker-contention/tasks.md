The measurement that matters is already recorded: 2.6 s alone, a hang
past 20 s beside one other file, 7.7 s for both under a single fork. Any
proposed fix has to move those numbers, and a green run on a quiet
machine proves nothing here — the failure only appears with a second
worker.

## 1. Find the actual blocker

- [ ] 1.1 Determine what `git.push.test.ts` waits on when a second worker
  is active. It builds a bare remote, a clone, a commit and a push —
  around eight `git` processes against temporary directories. Candidates:
  process spawning under two workers, the temp directory, `simple-git`'s
  own queue. Do **not** skip to a fix; the two notes this change corrects
  were both written by skipping to one.
- [ ] 1.2 Record what was found, including the candidates ruled out. The
  next person to see a hang here needs to know what has already been
  eliminated.

## 2. Fix it in one place

- [ ] 2.1 If the answer is that files spawning real subprocesses cannot
  share a worker pool on Windows, put that in
  `packages/core/vitest.config.ts` with its reason, once. Do **not**
  leave it as a flag people pass by hand — `acp-agent-capabilities` task
  3.2 already did that for one run, and a workaround nobody wrote down is
  a workaround that gets rediscovered.
- [ ] 2.2 Do **not** raise a timeout. It was tried: 20000 ms produced a
  20 s failure instead of a 5 s one, which is the clearest possible
  evidence that duration is not the problem.
- [ ] 2.3 Do **not** mock `git` away. These tests exist to exercise real
  `git` output; a mocked push proves nothing about a branch with no
  upstream, which is the defect `git.push.test.ts` was written for.
- [ ] 2.4 Whatever the fix, it must not slow the whole suite to fix two
  files. If a single fork for all of `packages/core` costs more than it
  saves, scope it to the files that need it and say so.

## 3. Correct the record

- [ ] 3.1 `harness-config-top-level-keys` task 3.2 records these two
  failures as "pre-existing co-load timeout flakiness already tracked by
  the open `load-sensitive-test-timeouts` change". Correct it: the cause
  is contention, not a short ceiling, and this change tracks it.
- [ ] 3.2 `acp-agent-capabilities` task 3.2 records the same two and the
  `--pool=forks --poolOptions.forks.singleFork=true` workaround. Correct
  it the same way, and note that the workaround was the diagnosis nobody
  read as one.
- [ ] 3.3 Leave `load-sensitive-test-timeouts` alone. Its ceilings are
  measured and correct for what they cover; the error was filing this
  under it, not anything it did.

## 4. Verification

- [ ] 4.1 `openspec change validate --strict core-test-worker-contention`.
- [ ] 4.2 `npm run test` green across all five workspaces, run **without**
  any hand-passed pool flag. That is the whole point.
- [ ] 4.3 Run it three times. A contention failure that appears once in
  three runs is still a contention failure, and one green run is what let
  this be recorded as flakiness twice.
- [ ] 4.4 Record the suite's total duration before and after, so a fix
  that trades a hang for a much slower suite is visible rather than
  silent.
- [ ] 4.5 No `packages/*/src` non-test source file changes.
- [ ] 4.6 No changeset — test infrastructure only, matching
  `openspec/changes/archive/2026-09-01-ci-job-timeouts/`.

From the owner's decision on 2026-10-08, after two chains went on to
`verify` and `archive` from an `apply` that had done nothing.

## 1. Core

- [x] 1.1 `harness-chain-runner.ts`: tell an unread checkpoint from an empty
  one; end the chain as failed after an `apply` that changed no file and
  ticked no task while a task it could do is open, naming the open tasks
  (design.md decisions 1-3). Tests in the chain runner's tests: such an
  apply ends the chain before `verify`; one whose open tasks are all
  **Human-only** or delegated goes on; one that changed files and ticked
  nothing still goes on and is named; one that ticked a task goes on.
  `readApplyCheckpoint` says whether the checkpoint was read;
  `describeApplyThatDidNothing` gives the reason. Four tests in "an
  implementing run that ticked nothing" (2026-10-08). Sixteen existing
  tests whose fake agent did nothing in `apply` while tasks were open,
  and which test what comes after `apply`, now have that agent change a
  file (`makeWorkingRunner`, `doSomeWork`); all 127 pass.
  The standalone e2e fake agent (`packages/server/e2e/fixtures/
  fake-agent-runner.ts`) also said it changed a file and changed none, so
  three specs that run a chain past `apply` stopped there in CI; it now
  writes `fake-agent-work.txt` in the working directory, outside the
  change's own diff. `pipeline.spec.ts`, `tour.spec.ts` and
  `harness-screenshots.spec.ts`: 7 passed locally.

## 2. Documents

- [x] 2.1 `HARNESS.md`: the `apply` row of the stage table.
  The row says such an apply ends the chain, naming the open tasks.
- [x] 2.2 A changeset: core, minor.
  `.changeset/an-apply-that-ticks-nothing-ends-the-chain.md`.

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint`, and the chain runner's tests.
  2026-10-08: typecheck clean; lint 0 errors (3 warnings, none in files
  this change touched). With two workers: `harness-chain-runner.test.ts`
  127 passed; the CLI's `run-change.test.ts` and `main.test.ts` 37
  passed; `server.test.ts` 110 passed. The full projects run in CI.
- [x] 3.2 `openspec validate an-apply-that-ticks-nothing-ends-the-chain
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.
  2026-10-08: valid under `--strict`; the gate named only this task as
  open.

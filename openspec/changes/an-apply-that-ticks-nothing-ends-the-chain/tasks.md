From the owner's decision on 2026-10-08, after two chains went on to
`verify` and `archive` from an `apply` that had done nothing.

## 1. Core

- [ ] 1.1 `harness-chain-runner.ts`: tell an unread checkpoint from an empty
  one; end the chain as failed after an `apply` that changed no file and
  ticked no task while a task it could do is open, naming the open tasks
  (design.md decisions 1-3). Tests in the chain runner's tests: such an
  apply ends the chain before `verify`; one whose open tasks are all
  **Human-only** or delegated goes on; one that changed files and ticked
  nothing still goes on and is named; one that ticked a task goes on.

## 2. Documents

- [ ] 2.1 `HARNESS.md`: the `apply` row of the stage table.
- [ ] 2.2 A changeset: core, minor.

## 3. Checks

- [ ] 3.1 `npm run typecheck && npm run lint`, and the chain runner's tests.
- [ ] 3.2 `openspec validate an-apply-that-ticks-nothing-ends-the-chain
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.

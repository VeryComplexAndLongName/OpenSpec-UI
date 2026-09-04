One number. It is worth a change only because the last two guesses about
this job were wrong — the global installs were blamed first, and they
cost 5.2 s of 244 s.

## 1. Raise the budget

- [x] 1.1 `.github/workflows/quality.yml`: `openspec-validate`'s
  `timeout-minutes` from 5 to 10.
- [x] 1.2 Comment it with the measurement, not the conclusion: `npm ci`
  at 223.6 s of a 244 s run, the same job observed at 2m22s and 5m15s on
  the same commit, and `quality` sharing that step with twice the budget.
- [x] 1.3 Change no other job's budget. `quality` and `browser-e2e` pass
  at theirs; raising every ceiling would hide the next real slowdown.

## 2. Verification

- [x] 2.1 `openspec change validate --strict merge-gate-timeout-headroom`.
- [x] 2.2 Parse the workflow and assert only `openspec-validate`'s
  `timeout-minutes` changed, and that every job's `needs` is untouched.
- [x] 2.3 `npm run typecheck`, `npm run lint`, `npm run test`. No source
  changes; a regression check. Read the whole failing-file list.
- [x] 2.4 No changeset: CI configuration, nothing published changes.
- [x] 2.5 The proof is this pull request's own merge gate passing, and
  #214's on a re-run. A budget change cannot be verified by reasoning
  about it.

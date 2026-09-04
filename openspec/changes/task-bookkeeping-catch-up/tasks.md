Ticking boxes is the easy half and the dangerous half. A record corrected
by assumption is no better than the one being corrected — it is just wrong
in the other direction, and harder to notice.

## 1. Verify before ticking

- [x] 1.1 For each of the four changes, check every claim against `main`:
  the code the task names, the test the task names, and — for a changeset
  item — the released entry in the relevant `CHANGELOG.md`. A task naming
  a symbol is verified by that symbol existing, not by recalling writing
  it.
- [x] 1.2 Record how each was verified, so this correction can itself be
  checked rather than trusted.
- [x] 1.3 Anything that cannot be verified stays open, and is named as
  unverified rather than quietly left.

## 2. Correct the four records

- [x] 2.1 `run-with-harness-prefills-the-run`: tick 1.1 through 5.3.
  Sixteen items, of which fifteen are verifiable here.
- [x] 2.2 `usage-from-acp`: tick 5.2 and 5.3.
- [x] 2.3 `event-guard-covers-every-kind`: tick 4.2 and 4.3.
- [x] 2.4 `usage-visible-while-running`: tick 5.2 and 5.3.
- [x] 2.5 Leave every human-only item open: `run-with-harness…` 5.4,
  `usage-from-acp` 5.4, `event-guard…` 4.4, `usage-visible…` 5.4,
  `ci-audit-own-job` 3.6, `dependabot-block-action-majors` 3.5,
  `changesets-action-v2` 4.5.
- [x] 2.6 Leave `ci-audit-own-job` 3.6 open specifically, and say why:
  half of it was observed (the audit is now its own check) and half was
  not (that the merge gate reports independently *when the audit fails*),
  which needs a failure to demonstrate. Closing it on the observed half
  is the inference this change exists to refuse.

## 3. Stop it recurring

- [x] 3.1 `openspec/README.md`: state the order. Run the verification
  items, then tick them, then commit — not tick, commit, and run. The
  same order produced the same omission four times, always at the last
  two items of a list.
- [x] 3.2 Say what the failure looks like from outside, since that is how
  it will be noticed next time: a shipped change whose `tasks.md` reads as
  untouched, which the archive step then refuses.

## 4. Verification

- [x] 4.1 `openspec change validate --strict` for all five changes
  touched — the four corrected and this one.
- [x] 4.2 Confirm no `tasks.md` gained a tick for an item whose evidence
  was not produced in 1.1. Compare the diff against that list, item for
  item.
- [x] 4.3 `npm run typecheck`, `npm run lint`, `npm run test`. No source
  changes; a regression check. Read the whole failing-file list.
- [x] 4.4 No changeset: bookkeeping and a runbook line, nothing published
  changes.

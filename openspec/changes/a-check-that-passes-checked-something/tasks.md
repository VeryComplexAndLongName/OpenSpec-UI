Six places where green does not mean what the name says, or where a
failure renders as nothing.

## 1. The changeset lint

- [ ] 1.1 `scripts/check-changesets.mjs`: read bare, single-quoted and
  double-quoted names; refuse a frontmatter line that is none of these,
  naming the file and line.
- [ ] 1.2 A test file for the script, or a fixture run in `lint:changesets`
  itself, with all three forms and a misspelled bare name that must
  fail.

## 2. The chart test

- [ ] 2.1 `packages/server/e2e/change-charts.spec.ts`: assert the per-day
  table's four rows carry two, one, zero and one.

## 3. The fixture

- [ ] 3.1 `create-dated-workspace.ts`: every git call passes
  `-c commit.gpgsign=false` and `-c core.hooksPath=<empty temp dir>`.
- [ ] 3.2 Grep the other e2e fixtures and unit-test helpers that commit
  and apply the same.

## 4. The folder-name test

- [ ] 4.1 `change-timeline.test.ts`, the folder-name case: commit the
  archive on a different day from the folder's, or without a commit,
  and assert the source is `folder-name`. Coordinate with
  `a-date-is-one-day-in-every-source`, which changes what the day means;
  whichever lands second keeps this assertion true.

## 5. The inbox says it failed

- [ ] 5.1 `standalone-entry.tsx`: the inbox state carries a failure
  reason; the block renders it where the count would be.
- [ ] 5.2 A webui test: a failing inbox request renders the reason, not
  nothing.

## 6. A bridge request that gets no reply

- [ ] 6.1 `bridge-request.ts`: a timeout, measured and recorded beside
  the constant, rejecting with the operation's name.
- [ ] 6.2 `HarnessSettingsView`: the rejection is shown and the disabled
  controls are re-enabled.
- [ ] 6.3 A test: a request with no reply rejects after the interval;
  a reply arriving after the rejection is ignored without error.

## 7. Verification

- [ ] 7.1 `openspec validate --strict --changes`.
- [ ] 7.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
- [ ] 7.3 Version bump via `npx changeset` for webui and server; the
  script change needs none.
- [ ] 7.4 The browser test in 2.1 run locally before the pull request,
  since CI runs it too and a wrong expected shape fails there.

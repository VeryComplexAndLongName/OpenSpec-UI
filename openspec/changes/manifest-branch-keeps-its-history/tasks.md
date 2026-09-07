Both constraints below came from the consumer, not from this repository,
and neither is checkable from inside it. Keep them stated where the code
is, so the next person to touch the publish step does not re-derive the
belief that was wrong.

## 1. Publish onto the branch

- [ ] 1.1 Fetch `release-manifest` before committing, and make the new
  commit on top of what is there.
- [ ] 1.2 Push without `--force`. Force is the mechanism of the defect,
  not an incidental flag: it is what makes the commit a consumer resolved
  stop existing.
- [ ] 1.3 Create the branch where it does not exist yet, once. After
  that it only grows.
- [ ] 1.4 Replace the "history on this branch serves nobody" comment with
  what is actually true: only the current *document* is read, and the
  *commit* it is read at has to survive. State that the consumer resolves
  a commit and fetches by it.
- [ ] 1.5 Never delete the branch as part of publishing. A deletion sends
  a push event whose `after` is the zero commit, which the consumer
  ignores — so a delete-then-create publish is invisible to it even when
  the document is correct.

## 2. Announce the manifest commit

- [ ] 2.1 The webhook body's `commit` is the commit just made on
  `release-manifest`, not `$GITHUB_SHA`. Today it names the `main` commit
  that triggered the release, which is in a different history.
- [ ] 2.2 Capture the commit from the push itself rather than
  recomputing it, so the value announced is the one that landed.
- [ ] 2.3 Leave the rest of the notification alone — the HMAC signing,
  the secret read from the environment, the one-line `node -e` programs,
  and the "never fail the job over a lost delivery" posture all have
  recorded reasons and none of them are what is broken.

## 3. Verification

- [ ] 3.1 `openspec change validate --strict manifest-branch-keeps-its-history`.
- [ ] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. No package source changes here, so this is a regression check,
  not evidence the change works.
- [ ] 3.3 No changeset: CI configuration, nothing published changes.
- [ ] 3.4 Extract the publish step and run it against a scratch remote:
  publish twice, and confirm the second commit has the first as an
  ancestor and the first is still fetchable. The equivalent script has
  been run against a stub receiver before, for the webhook — and that is
  the only reason the multi-line `node -e` defect was caught before it
  shipped.
- [ ] 3.5 **Human-only**: after this merges, at the next release, confirm
  `git log release-manifest` shows more than one commit and that the
  site's sync reports no `404`. That is the whole test, and it cannot run
  before the release does.

Both constraints below came from the consumer, not from this repository,
and neither is checkable from inside it. Keep them stated where the code
is, so the next person to touch the publish step does not re-derive the
belief that was wrong.

## 1. Publish onto the branch

- [x] 1.1 Fetch `release-manifest` before committing, and make the new
  commit on top of what is there.
  Done: the work directory adds `origin` and fetches the branch, then
  checks out `FETCH_HEAD`, so the new commit has it as a parent.
- [x] 1.2 Push without `--force`. Force is the mechanism of the defect,
  not an incidental flag: it is what makes the commit a consumer resolved
  stop existing.
  Done. Fetched in full rather than `--depth 1`, because pushing from a
  shallow clone is refused by some servers and this branch holds one
  small JSON file per release.
- [x] 1.3 Create the branch where it does not exist yet, once. After
  that it only grows.
  Done: the `else` arm creates it, and only that first time.
- [x] 1.4 Replace the "history on this branch serves nobody" comment with
  what is actually true: only the current *document* is read, and the
  *commit* it is read at has to survive. State that the consumer resolves
  a commit and fetches by it.
  Done. The replacement states the distinction that was missed — only
  the current document is read, but the commit it is read at has to
  survive — and records the three measured commits and the 404s.
- [x] 1.5 Never delete the branch as part of publishing. A deletion sends
  a push event whose `after` is the zero commit, which the consumer
  ignores — so a delete-then-create publish is invisible to it even when
  the document is correct.
  Done by construction: nothing in the step deletes a ref.

## 2. Announce the manifest commit

- [x] 2.1 The webhook body's `commit` is the commit just made on
  `release-manifest`, not `$GITHUB_SHA`. Today it names the `main` commit
  that triggered the release, which is in a different history.
  Done: the body now sends `MANIFEST_COMMIT`.
- [x] 2.2 Capture the commit from the push itself rather than
  recomputing it, so the value announced is the one that landed.
  Done: `git rev-parse HEAD` is read after the push that landed it, and
  published as the step output the notify step consumes. The notify step
  refuses to send at all if that output is empty, rather than falling
  back to a commit the site cannot fetch.
- [x] 2.3 Leave the rest of the notification alone — the HMAC signing,
  the secret read from the environment, the one-line `node -e` programs,
  and the "never fail the job over a lost delivery" posture all have
  recorded reasons and none of them are what is broken.
  Done: signing, the environment-read secret, the one-line `node -e`
  programs and the never-fail-the-job posture are untouched.

## 3. Verification

- [x] 3.1 `openspec change validate --strict manifest-branch-keeps-its-history`.
  Run 2026-09-07: "Change 'manifest-branch-keeps-its-history' is valid".
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. No package source changes here, so this is a regression check,
  not evidence the change works.
  Run 2026-09-07: typecheck clean; lint clean apart from one warning
  that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 604 core,
  280 extension, 62 server, 265 webui. A regression check, as stated —
  no package source changed here. The workflow was additionally parsed
  and its job list compared: 9 jobs, the same 9 as before, because a
  truncated workflow still parses and losing a job that way has
  happened in this repository before.
- [x] 3.3 No changeset: CI configuration, nothing published changes.
- [x] 3.4 Extract the publish step and run it against a scratch remote:
  publish twice, and confirm the second commit has the first as an
  ancestor and the first is still fetchable. The equivalent script has
  been run against a stub receiver before, for the webhook — and that is
  the only reason the multi-line `node -e` defect was caught before it
  shipped.
  Run 2026-09-07. Script kept out of the repository on purpose: the
  workflow already carries a scar from a simulation that drifted from the
  thing it simulated (it added `--silent` where the workflow had none),
  and a committed copy invites that again. It lives at
  `scratchpad/publish-twice.sh` and the run is recorded here instead.

  Publishing twice against a scratch bare remote:
  - PASS the second commit has the first as an ancestor
  - PASS the first commit is still fetchable after the second publish
  - PASS the document at the first commit is the one published then
  - PASS the branch holds 2 commits, not 1
  - PASS a racing publish was refused rather than overwriting

  Shown to be able to fail: the same assertions run against the old shape
  of the step (`git init` plus `push --force`) report "the second commit
  does not descend from the first", "the first commit is gone", "the
  first commit does not carry its own document" and "the branch holds 1
  commits" — which is exactly what was measured on the live branch today.
- [x] 3.5 **Human-only**: after this merges, at the next release, confirm
  `git log release-manifest` shows more than one commit and that the
  site's sync reports no `404`. That is the whole test, and it cannot run
  before the release does.
  Confirmed live on 2026-09-08 after release `openspec-ui-vscode@0.42.0`.
  The remote `release-manifest` branch has two commits, including
  `14276e5d...` for the current release. The deployed site shows the
  `0.42.0` VS Code release card, and its Download VSIX link returned HTTP
  200 rather than 404. The workflow's release-manifest job also completed
  successfully and published that manifest commit.

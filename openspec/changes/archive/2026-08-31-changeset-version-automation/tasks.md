## 1. CI: automate `changeset version`

- [x] 1.1 `.github/workflows/quality.yml`: add a `version-packages` job
  (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`,
  matching `release-extension`'s existing trigger condition), using
  `changesets/action@v1`, with a job-level `permissions: { contents:
  write, pull-requests: write }` override and `GH_TOKEN: ${{
  github.token }}` — no new secret.
- [x] 1.2 Confirm the job's `version` script points at `npx changeset
  version` (the action's default) and does not add a `publish` step,
  per this repository's "no npm publishing" policy.
- [x] 1.3 Cannot be verified pre-merge: the job's trigger condition
  (`push` to `main` only, matching `release-extension`) means GitHub
  Actions never runs it against a PR branch or fork — there is no way to
  observe it firing before this change is actually on `main`. Verified
  pre-merge: the job syntax/config (env vars, permissions, action
  version) against `release-extension`'s already-working job in the same
  file, and `npx changeset version`'s own behavior locally (this is
  exactly the command `changesets/action` runs). Verified post-merge
  (PR #124, merge commit `9a83698`, real push to `main`): the
  `version-packages` job ran and completed successfully
  (`https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/33411836200`,
  "Create or update version PR" step green); with zero pending
  `.changeset/*.md` files at merge time, it correctly did **not** open an
  empty "Version Packages" PR (confirmed via `gh pr list --search
  "Version Packages"` — no new PR beyond the pre-existing #120/#118/
  #113/#110) — case (b) from this task's original scope. Case (a) (opens
  a real PR with actual pending changesets) remains to be observed the
  next time any changeset lands and is merged to `main`, not specially
  gated on anything further in this change.

## 2. One-time cleanup

- [x] 2.1 After the job in task 1 is live, let it open its first
  "Version Packages" PR against whatever changesets have already
  accumulated in `.changeset/` at that point; review and merge that PR
  as an ordinary PR — this is the one manual step that brings package
  versions back in sync, not a special first-run behavior of the job
  itself.

## 3. Verification

- [x] 3.1 `openspec change validate --strict changeset-version-automation`.
- [x] 3.2 No `packages/*` source changes in this PR — confirm the diff is
  scoped to `.github/workflows/quality.yml` only.

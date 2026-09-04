One line of script and one workflow input. The care is in establishing
that the step does only what it is being added for — a lockfile
regeneration that also re-resolved dependencies would slip unreviewed
updates into a release pull request, which is worse than the drift it
fixes.

## 1. Keep the lockfile with the versions

- [ ] 1.1 Root `package.json`: `changeset:version` runs
  `npm install --package-lock-only` after `changeset version`. Reuse the
  existing script rather than adding a name — a local run should do what
  CI does.
- [ ] 1.2 `.github/workflows/quality.yml`: point the release action at
  that script with `version-script`. Without it the action runs its own
  built-in `changeset version` and the extra step never happens.
  (`version-script` is v2's name for the input v1 called `version` — see
  `changesets-action-v2`.)
- [ ] 1.3 Correct today's stale entry (`packages/cli`, lockfile 0.1.2
  against package.json 0.2.0) in the same change.

## 2. Establish the step is safe

- [ ] 2.1 Run `npm install --package-lock-only` against this repository
  and diff the lockfile. Record what changed. If anything but a
  workspace version moved, stop: this approach slips dependency updates
  into releases and needs a different mechanism.
- [ ] 2.2 Say in the proposal what was measured, so the next person can
  re-check it rather than trust it — npm's resolution behaviour is not a
  fixed property of the tool.

## 3. Verification

- [ ] 3.1 `openspec change validate --strict lockfile-follows-the-release`.
- [ ] 3.2 Assert the lockfile and the five `package.json` files agree,
  by reading both rather than by eye.
- [ ] 3.3 `npm ci` still succeeds against the corrected lockfile — the
  point of the file is that a clean install works from it.
- [ ] 3.4 `npm run typecheck`, `npm run lint`, `npm run test`.
- [ ] 3.5 No changeset: repository tooling, nothing published changes.
- [ ] 3.6 **Human-only**: at the next release, confirm the "Version
  Packages" pull request's diff includes `package-lock.json`. That is the
  only way to see this working — the job is gated to `main` and its own
  pull request cannot run it.

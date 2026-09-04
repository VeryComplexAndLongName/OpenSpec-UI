The migration itself is two lines. The work is establishing that it is
two lines, against a release-notes list of eight breaking changes — and
being explicit that the job this alters cannot be run before merge.

## 1. Migrate

- [x] 1.1 `.github/workflows/quality.yml`: `changesets/action@v1` →
  `changesets/action@v2`.
- [x] 1.2 Remove the step's `env: GH_TOKEN` block and pass
  `github-token: ${{ github.token }}` as an input instead. Same value;
  the difference is that the input is where the action reads it. Leaving
  the env in place would preserve a line that has never done anything in
  either version.
- [x] 1.3 Comment the step with what the API-push default changes —
  commit attribution and GPG signing — so a "Version Packages" commit
  suddenly attributed differently is recognised rather than investigated.

## 2. Establish the migration is safe here, item by item

Each of these is a claim about *this* configuration, checked against the
action's own `action.yml` at each ref rather than against the release
notes' prose.

- [x] 2.1 `github-token` exists in v1 with the same
  `default: ${{ github.token }}` — so the removal of `GITHUB_TOKEN` env
  support changes nothing here, and the existing `env: GH_TOKEN` was
  never load-bearing.
- [x] 2.2 None of the renamed inputs are passed by this workflow.
- [x] 2.3 `push-git-tags` defaulting to `true` cannot create tags here,
  because it applies after a publish step and no `publish-script` is
  configured. Confirm `release-extension`'s own tagging is untouched.
- [x] 2.4 `@changesets/cli` is already on the major v2 requires.
- [x] 2.5 The job already grants the permission the API push needs.

## 3. Be explicit about what is unverified

- [x] 3.1 Say in the proposal, the commit message and the pull request
  that `version-packages` is gated to `main` and will show as `skipping`
  on this very pull request — so its green checks are not evidence about
  it.
- [x] 3.2 Name what the first real execution is: the next push to `main`
  carrying pending changesets.
- [x] 3.3 Do not mark the human-only verification below as done on the
  strength of the pull request passing. That is exactly the inference
  this change exists to refuse.

## 4. Verification

- [x] 4.1 `openspec change validate --strict changesets-action-v2`.
- [x] 4.2 Parse the workflow and assert the step references `@v2`,
  passes `github-token`, and carries no `env` block — and that no other
  job's configuration changed.
- [x] 4.3 `npm run typecheck`, `npm run lint`, `npm run test`. No source
  changes; a regression check.
- [x] 4.4 No changeset: CI configuration, nothing published changes.
- [ ] 4.5 **Human-only, and the only real test**: after this merges, the
  next `main` push with a pending changeset must produce or update a
  "Version Packages" pull request. If none appears, this is the change to
  revert.

## Why

Third and final step of a user-requested, ordered sequence raised during
a repository review session on 2026-08-25/26 (after `adopt-changesets`
and `add-mit-license`): there was no `SECURITY.md`, no documented
vulnerability-reporting channel, and GitHub's private vulnerability
reporting feature was not enabled for this repository -- a natural gap
to close right after the same day's `npm audit` investigation
(`fix-nanoid-vulnerability`) had already surfaced real findings and an
explicit, tracked accepted-risk decision (the `vitest`/`mocha` majors
blocked by `.github/dependabot.yml`).

## What Changes

- Enable GitHub's private vulnerability reporting for this repository
  (`PUT /repos/.../private-vulnerability-reporting`, verified via the
  API before and after: `enabled: false` -> `enabled: true`) -- this is
  the actual reporting channel `SECURITY.md` points to, so it needed to
  exist, not just be documented.
- Add `SECURITY.md` at the repository root: how to report (GitHub
  private security advisories, not a public issue, not a personal
  email), what to include, a "Supported Versions" note (only the latest
  version of each package, no LTS branches), a "Scope" note (this is a
  local-first tool -- standalone server binds to `localhost` only,
  extension runs inside the user's own editor process), and a "Known
  Accepted Risks" section referencing the already-archived
  `ignore-vitest-major` and `fix-nanoid-vulnerability` changes instead of
  re-enumerating specific CVEs (which would go stale immediately, the
  same staleness problem already hit twice today with version tables and
  template counts).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; documentation and a repository security setting, not a specified
product behavior)

## Impact

- `SECURITY.md` (new)
- GitHub repository setting: private vulnerability reporting (enabled)

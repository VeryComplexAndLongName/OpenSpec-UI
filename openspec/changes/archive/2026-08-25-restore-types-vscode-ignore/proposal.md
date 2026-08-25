## Why

The `ignore-all-dependabot-majors` change (archived 2026-08-25) replaced
four package-specific Dependabot `ignore` entries -- including the one for
`@types/vscode` from the archived `ignore-types-vscode-major` change --
with a single blanket rule ignoring every semver-major bump. That merge
(resolving PR #70's conflict against the just-merged PR #68) dropped the
`@types/vscode` entry as "redundant", which was wrong: `@types/vscode`'s
own version tracks VS Code's version, not this package's API surface, and
VS Code has never shipped a 2.0 -- so `1.90` -> `1.134` is a semver-MINOR
bump ("1" never changes). The blanket major-only rule does not match minor
bumps, so it does not catch this case at all. Confirmed live: PR #71
("Bump @types/vscode from 1.125.0 to 1.134.0") reproduces the exact same
`vsce package` failure as PR #67 ("@types/vscode ^1.134.0 greater than
engines.vscode ^1.90.0"), because the specific rule that used to catch it
is gone and the blanket rule doesn't apply.

## What Changes

- Add the `@types/vscode` (versions `>=1.91.0`) `ignore` entry back to
  `.github/dependabot.yml`'s `npm` update block, alongside the blanket
  `dependency-name: "*"` / `semver-major` rule from `ignore-all-dependabot-
  majors` -- the two rules are independent (Dependabot ignores a dependency
  if it matches either), not conflicting.
- Update the rule's comment to explain why it must coexist with the
  blanket rule (semver-minor practically-breaking bump, not a major one).
- No change to the grouping, schedule, or the `github-actions` update block.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; CI/tooling configuration change, not a specified behavior)

## Impact

- `.github/dependabot.yml`

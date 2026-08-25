## Why

Over 2026-08-25, four separate Dependabot grouped PRs (#62, #65, #67, and
the earlier incident behind the archived `pin-dependabot-typescript-eslint`
change) each broke this repo's pinned toolchain, one dependency at a time:
`typescript` 6->7 and `eslint` 9->10 (both break `typescript-eslint`),
`@eslint/js` 9->10 (peer-conflicts with the pinned `eslint`), `vitest` 2->4
(broken native bindings, needs a newer Node.js), and `@types/vscode`
1.90->1.134 (exceeds `packages/extension`'s `engines.vscode`, so `vsce
package` refuses to build). Each was fixed reactively by adding a
package-specific `ignore` entry to `.github/dependabot.yml` after CI had
already failed on a real PR. The user asked directly for a structural fix
rather than continuing to chase individual package names one at a time
("how much longer do we keep catching PR problems?" -- repository review
session, 2026-08-25). Every one of these four incidents was a
major-version bump; none was a minor or patch update.

## What Changes

- Replace the four package-specific `ignore` entries (`typescript`,
  `eslint`, `@eslint/js`, `vitest`) in `.github/dependabot.yml`'s `npm`
  update block with a single blanket rule: `dependency-name: "*"` with
  `update-types: ["version-update:semver-major"]`. This ignores every
  major-version bump for every npm dependency in this repo, not just the
  four that have already broken CI.
- Effect: Dependabot keeps proposing minor/patch updates automatically
  (including security fixes) in the existing weekly grouped PR; major
  version bumps are no longer proposed at all, and must be picked up
  deliberately (a manual `npm install <pkg>@latest` plus a reviewed,
  non-grouped change) when the team is ready to absorb the breaking change.
- Supersedes the `ignore-types-vscode-major` change (also archived
  2026-08-25, merged as PR #68 before this change landed): its
  package-specific `@types/vscode` rule is now redundant under the blanket
  rule and was removed by this change's merge-conflict resolution against
  `main`.
- No change to the grouping, schedule, or the `github-actions` update block.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; CI/tooling configuration change, not a specified behavior)

## Impact

- `.github/dependabot.yml`

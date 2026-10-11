# Tasks

## 1. Runtime Pins

- [x] 1.1 Set root `engines.node` to `>=24.2 <25` and Volta Node to
  `24.21.0`; keep npm at `10.9.0`.
- [x] 1.2 Update the root `package-lock.json` engine metadata to match.
- [x] 1.3 Set `NODE_VERSION` to `24.21.0` in GitHub quality, GitHub publish,
  and Gitea quality workflows.
- [x] 1.4 Clarify the historical Node 22.11.0 reference in the Dependabot
  comment; retain dated historical test evidence unchanged.
- [x] 1.5 Add a `quality-gates` delta requiring the same Node pin for developer
  metadata and all CI workflows.

## 2. Verification

- [x] 2.1 Verify the active worktree runtime and pins: Node `v24.21.0`, npm
  `10.9.0`, root engine/Volta, lockfile engine, and all three workflows agree.
- [x] 2.2 Validate with
  `openspec change validate --strict node24-workspace-runtime`; valid.
- [x] 2.3 **CI-required.** Confirm the full quality workflow passes on
  Node 24.21.0, including the VS Code Electron integration/removal test. Do not
  run the full suite locally. Verified by GitHub Actions run 38119901084:
  Typecheck/lint/test/build job 114412291980 and extension integration/package
  job 114412667801 both passed on Ubuntu. This is not a Windows-native run.
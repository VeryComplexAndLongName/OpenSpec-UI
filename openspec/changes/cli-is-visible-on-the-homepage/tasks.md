# Tasks

## 1. Manifest Producer

- [x] 1.1 In `packages/cli/src/release-manifest.ts`, set only `ci-cli.public`
  to true and add its summary; preserve all five ids and package version sources.
- [x] 1.2 In `packages/cli/src/release-manifest.ts`, add optional `ProductLinks.npm`
  and populate only the CLI destination `https://www.npmjs.com/package/@openspec-ui/cli`.
  Keep schema version 1 and do not invent a GitHub release or artifact.
- [x] 1.3 In `packages/cli/src/release-manifest.test.ts`, assert four public products,
  only Shared UI private, CLI summary/npm URL, other products without npm links,
  all five stable ids, schema 1, and unchanged attachment behavior.
- [x] 1.4 In `packages/cli/src/release-manifest.test.ts`, exercise `write manifest`
  serialization so `public`, version and `links.npm` reach the emitted JSON.
- [x] 1.5 In `packages/cli/README.md`, document CLI public manifest metadata and
  the distinction between the repository version and separately dispatched npm publication.
- [x] 1.6 Add `.changeset/cli-is-visible-on-the-homepage.md` proposing a minor
  `@openspec-ui/cli` bump. Do not edit package versions directly.
  Verified 2026-10-10: `npm run lint:changesets` passes; package versions untouched.

## 2. Verification and Rollout

- [x] 2.1 Run the focused `packages/cli/src/release-manifest.test.ts` suite using
  the pinned runtime; record counts and command output here.
  Passed 2026-10-10: `npm run test --workspace @openspec-ui/cli -- src/release-manifest.test.ts`,
  20 tests in 30.49s, Node 22.11.0 and npm 10.9.0, in this worktree.
- [x] 2.2 Run root `npm run typecheck`, `npm run lint` and `npm run test` unpiped
  with the pinned runtime; record results and package counts here.
  2026-10-10: workspace typecheck and lint pass on Node 22.11.0/npm 10.9.0.
  Full test gate was stopped after unchanged `packages/core/src/git-refs.test.ts`
  failed with Git Bash `fatal error - add_item ... errno 1` during fetch.
  Main core pool: 2234 passed. Separate CLI package run: 218 passed, 1 timeout
  in the existing dynamic-import test `prints a manifest built from the repository`
  (30s ceiling); a repeat with requested serial execution still timed out.
  Focused manifest suite previously passed all 20 tests. Budgets were not changed.
  Passed on Linux CI 2026-10-10: Quality run 38082255993, job 114301411234
  (`npm run verify` and build), Node 22.11.0/npm 10.9.0. Counts: CLI 219,
  core 2234 plus git-subprocess 77, extension 537, server 132, webui 761.
  This observed CI result resolves the earlier local environment failures.
- [x] 2.3 Validate this change with `openspec validate cli-is-visible-on-the-homepage --strict`.
- [x] 2.4 Generate `releases.json` using the exact
  `write manifest` CI invocation and validate it with the companion homepage's
  `app/schemas/manifest.py`; record both commands and evidence for `ci-cli.public`
  and `ci-cli.links.npm`. Do not modify the homepage's production snapshot manually.
  Partial evidence 2026-10-10: direct worktree CLI entry point generated JSON
  that the real homepage scheduled sync persisted and rendered as CLI 0.29.0
  with the correct npm button. Exact `npm run ... write manifest` invocation
  on Windows failed to resolve package files; the Linux CI invocation remains
  outstanding. No registry publish or production snapshot was modified.
  Verified 2026-10-10 by GitHub Copilot in VS Code: `npm.cmd run start --silent
  --workspace @openspec-ui/cli -- write manifest --cwd <producer-worktree>
  --repository VeryComplexAndLongName/OpenSpec-UI --commit 8175843b` generated
  `C:/Temp/openspec-linux-releases.json`. Using native npm.cmd fixed forwarded
  arguments lost by the PowerShell wrapper. The deployed Homepage revision
  2c6089189ee6e75f267f3346092688073c32514f's `ReleaseManifest.model_validate_json`
  accepted it and printed `1 ci-cli 0.29.0 True https://www.npmjs.com/package/@openspec-ui/cli`.
  Existing live scheduled-sync/browser evidence covers persistence and display.
  The delegated verification was completed directly with these executable checks;
  no claim is made that a separate copilot-cli agent ran.
- [x] 2.5 Transfer post-merge rollout verification to the separately tracked
  `cli-homepage-rollout` change, without claiming deployment has happened.
  Deferred to `cli-homepage-rollout` tasks 1.1-1.6, approved by the owner
  on 2026-10-10. Production remains unverified until that successor records
  deploy/release run ids, manifest commit and the live CLI version/npm button.

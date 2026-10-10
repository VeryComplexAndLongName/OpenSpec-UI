Asked for by the owner on 2026-10-10: publish `@openspec-ui/cli` to npm
from the pipeline despite two-factor authentication, together with the
Marketplace publish in one run, and only what belongs to each channel.
Decisions are in ADR-0048.

## 1. The workflow

- [x] 1.1 A new `.github/workflows/publish.yml` with `on:
  workflow_dispatch` and no other trigger, taking `vscode_version`,
  `cli_version` (both optional) and `confirm`; `publish-marketplace.yml`
  is removed.
- [x] 1.2 A `confirm` job refuses a run unless `confirm` reads exactly
  `publish` and at least one version is named; `marketplace` and `npm`
  both declare `needs: confirm` and run only for a non-empty version.
- [x] 1.3 The `marketplace` job is the former publishing job: release
  lookup, `.vsix` download, `vsce publish --packagePath`, `VSCE_PAT`,
  `environment: marketplace`.
- [x] 1.4 The `npm` job is bound to `environment: npm`, holds
  `id-token: write` and no token, refuses a ref other than `main`,
  refuses a version that `packages/cli/package.json` does not state or
  that `npm view` finds, builds with the pinned npm, installs
  `npm@11.5.1` and runs `npm publish --access public` in `packages/cli`.

## 2. The check that keeps it that way

- [x] 2.1 `scripts/check-publish-workflow.mjs` reads `publish.yml` and
  checks both channels as `design.md` lists.
- [x] 2.2 `scripts/check-publish-workflow.test.mjs` breaks each new
  guarantee once and asserts the failure by its words.

## 3. What the documents say

- [x] 3.1 `docs/adr/0048-...md` recorded, indexed in `docs/adr/README.md`,
  and ADR-0009's status points at it.
- [x] 3.2 `README.md` and `.changeset/README.md` describe the one dispatch
  and stop saying that nothing is published to npm; neither names a token.

## 4. Checks

- [ ] 4.1 `npm run typecheck && npm run lint && npm run test`, run
  unpiped. Record each package's count.
- [x] 4.2 No changeset is written: no package's behaviour changes, and
  `lint:changesets` passes without one.
- [x] 4.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text`, `lint:screenshots` and
  `lint:publish-workflow` pass.

  Done 2026-10-10: all passed; the publish workflow's 20 script tests pass.
- [x] 4.4 `openspec validate one-dispatch-publishes-to-both-channels
  --strict` passes.
- [ ] 4.5 **Human-only, and the owner's alone.** On npmjs.com the trusted
  publisher for `@openspec-ui/cli` names `publish.yml` and the `npm`
  environment, and the `npm` environment exists in the repository's
  settings. Nothing in this change publishes anything, and no agent may
  dispatch it.
- [ ] 4.6 **Human-only, and the owner's alone.** The first real npm
  publish: dispatch `Publish` from `main` with `cli_version` and the
  confirmation, and check the package page.

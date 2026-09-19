Asked for by the owner on 2026-09-19, handing over a Marketplace token:
build publishing into the process as a manual step, because not everything
should reach the Marketplace.

## 1. The workflow

- [x] 1.1 A new `.github/workflows/publish-marketplace.yml` with
  `on: workflow_dispatch` and no other trigger, taking two inputs:
  `version` (the extension version, as `packages/extension/package.json`
  states it) and `confirm`.
- [x] 1.2 The job's first step refuses the run unless `confirm` reads
  exactly `publish`, with a message naming what was typed. Do not accept a
  case-insensitive match or a prefix: the field exists to be deliberate.
- [x] 1.3 The job resolves `openspec-ui-vscode@<version>`, downloads the
  `.vsix` attached to that tag's GitHub Release with `gh release download`,
  and fails with a message naming the tag where the release or the asset is
  absent.
- [x] 1.4 The job publishes that file with
  `vsce publish --packagePath <file>`, reading `VSCE_PAT` from the
  repository secret. It does not rebuild the extension and does not check
  out `main`.
- [x] 1.5 The job declares `environment: marketplace` and
  `permissions: contents: read`, and its name says what it does
  ("Publish to the Marketplace").
- [x] 1.6 The workflow's own comment says what the automatic path does
  (tag and Release) and why this one is separate, in the way
  `quality.yml`'s "Which event runs what" comment does.

## 2. The check that keeps it that way

- [x] 2.1 A new `scripts/check-publish-workflow.mjs` reads
  `.github/workflows/publish-marketplace.yml` and fails where its `on:`
  names anything but `workflow_dispatch`.
- [x] 2.2 The same script fails where the `confirm` input is absent, where
  no step compares it to `publish`, where `VSCE_PAT` is read by a job other
  than the publishing one, or where `vsce publish` appears without
  `--packagePath`.
- [x] 2.3 The same script fails where any other workflow in
  `.github/workflows/` mentions `VSCE_PAT` or `vsce publish`, so a second
  path cannot be added quietly.
- [x] 2.4 `package.json`'s `lint` script runs it, beside the other
  repository checks, and `npm run lint` passes.
- [x] 2.5 `scripts/check-publish-workflow.test.mjs` covers: the workflow as
  written passing, a `push:` trigger failing, a missing confirmation
  failing, a `vsce publish` without `--packagePath` failing, and a second
  workflow naming `VSCE_PAT` failing.

## 3. What the documents say

- [x] 3.1 `README.md`'s release section says the automatic path tags and
  publishes a GitHub Release, and that reaching the Marketplace is a
  separate step somebody asks for by version.
- [x] 3.2 `.changeset/README.md` stops saying the extension "still ships
  via `vsce`/the VS Code Marketplace" as though a merge did it, and says
  what actually follows a version bump.
- [x] 3.3 Neither document names the token, its value or where it is kept
  beyond "a repository secret".

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-19: `npm run typecheck` and `npm run lint` green across the
  workspace, the new publish workflow check among the lints. `npm run
  test`: the repository's own script suites pass (the publish workflow's
  11 among them), core 1578 in 114 files, cli 4 in 2, extension 438 in 31,
  server 109 in 4, webui 606 of 607 in 71 - the one failure is the known
  Windows-only `scripts/build-metro-icons.test.mjs` line-ending
  comparison, which fails here on an untouched tree and passes in CI.
- [x] 4.2 A changeset is not written for this change: it touches no
  package's behaviour - CI configuration, one script and two documents -
  and `lint:changesets` passes without one.
- [x] 4.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [x] 4.4 `node scripts/check-publish-workflow.mjs` passes against the
  workflow as committed, and `npx vitest run scripts/check-publish-workflow.test.mjs`
  reports its count.

  Done 2026-09-19: `node scripts/check-publish-workflow.mjs` reports
  "Publish workflow check passed" against the workflow as committed, and
  `node --test scripts/check-publish-workflow.test.mjs` reports 11 passed,
  0 failed.
- [x] 4.5 **Human-only, and the owner's alone.** The first real publish.
  The workflow is dispatched by a person against a released version, and
  what the Marketplace then shows is theirs to check. Nothing in this
  change publishes anything, and no agent may dispatch it.

  Done 2026-09-19 by the owner, who dispatched the workflow and deployed:
  run 35425382249, conclusion success, 33 seconds. Its log reads
  "Confirmed. Publishing openspec-ui-vscode 0.63.0.", then "Publishing
  publish/openspec-ui-vscode-0.63.0.vsix, as it was released.", then
  "Publishing 'openspec-ui.openspec-ui-vscode v0.63.0'..." - the artifact
  from that version's GitHub Release, not a rebuild, which is what this
  change set out to guarantee.
  https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/35425382249
- [x] 4.6 **Human-only.** Whether a typed confirmation plus an environment
  is the right amount of friction, or one gate too many for a step the
  owner will take every few releases.

  Done 2026-09-19 by Claude at the owner's request, for the owner to look
  at in turn.

  Two gates read as the right amount for a step taken every few releases,
  because they are not the same gate twice. The typed word answers "did
  somebody mean to press this", which a green button on the Actions tab
  does not; the environment answers "is there a record of what went out
  and when", and it costs the person dispatching nothing at all while no
  protection rule is set on it. The version field is the third thing, and
  the one that would be missed if any were dropped: it is what makes the
  publish name an artifact rather than a moment.

  What would be one gate too many is a required reviewer on the
  environment while the owner is the only reviewer - it would mean
  approving one's own dispatch, which teaches the hand to click through.
  That is why it is left unset here and only made easy to add.

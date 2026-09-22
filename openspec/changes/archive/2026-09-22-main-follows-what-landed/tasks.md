Asked by the owner on 2026-09-21, after an archive pull request left its
changes on screen and a fourth change it archived had been on no view.

## 1. Main follows

- [x] 1.1 `branches.followMain` (absent means on), validated, in the
  schema, read by `followsMain`.
- [x] 1.2 The sweep's last step: `catchUpWithMain` on the checkout the
  host has open, only where it is the main working directory on `main`
  and no run works in it; what became of `main` is said.
- [x] 1.3 The editor sweeps again 15 minutes after opening an archive
  pull request, one timer at a time.

## 2. Saying what is not here

- [x] 2.1 `readMainDrift` lists the changes under way on `origin/main`
  that the checkout does not hold; `driftWords` names them.
- [x] 2.2 `landedArchiveTitle`: an archive pull request and its commit
  name what they archive.

## 3. Documentation

- [x] 3.1 `HARNESS.md` (`branches.followMain`, where it is edited) and
  `README.md`.

## 4. Checks

- [x] 4.1 Tests: the sweep brings a clean `main` up to a commit landed
  elsewhere, leaves one with an edit in its tree and says why, and leaves
  it alone where the setting is off (real git, a bare remote and a second
  clone); the drift names what landed and is not here, and nothing where
  level; titles; the setting; the schemas.
- [x] 4.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped. typecheck and lint pass. Tests: cli 175,
  core 1765 and 37, extension 483, server 114, webui 645 of 646. The one
  failure is `packages/webui/scripts/build-metro-icons.test.mjs`, which
  fails on Windows for its line endings and fails the same way on untouched
  `main`.
- [x] 4.3 The whole standalone browser suite passes: 28 of 28.
- [x] 4.4 The extension's integration suite passes: 18 passing.
- [x] 4.5 A changeset: core, the server and the extension, minor.
- [x] 4.6 `openspec validate main-follows-what-landed --strict`.
- [x] 4.7 **Human-only.** The owner's editor, on a build with this, brings
  `main` up after an archive pull request merges, and the changes leave
  Changes without a pull. **Deferred:** it needs the release that carries
  this change, loaded in the owner's window. Moved to
  `openspec/deferred.md`.

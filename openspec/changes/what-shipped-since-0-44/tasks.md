The last article for a user covers 0.40 → 0.44. The extension is
0.50.2, and twenty-eight archived changes later nobody has been told
what they can now do.

## 1. The article

- [ ] 1.1 `docs/articles/2026-09-12-what-you-can-run-now-0-44-to-0-50.md`
  exists, opens by naming the version range, and states which package
  versions it was written against (`core`, `server`, `webui`,
  `extension`, `cli`) read from each `package.json` rather than assumed.
- [ ] 1.2 A section on running a change from a terminal: `openspec-ui-cli
  run <change>`, what its three exit codes mean, and that it takes the
  same workspace lease the two interactive hosts take. Cites
  `openspec/changes/archive/2026-09-11-a-change-runs-from-the-terminal/`.
- [ ] 1.3 A section on changes running side by side: one git worktree per
  change, `openspec-ui-cli worktree add <change>`, and that overlap is
  decided from the file paths tasks declare. Cites
  `.../2026-09-11-changes-run-side-by-side/`.
- [ ] 1.4 A section on what can start now: `openspec-ui-cli ready`, and
  that an empty queue reports success rather than failure. Cites
  `.../2026-09-11-what-can-start-now/` and
  `.../2026-09-11-an-empty-queue-is-not-a-failure/`.
- [ ] 1.5 A section on handing one numbered task to an agent:
  `taskAgents`, the Human-Only Inbox, and **OpenSpec UI: Run This
  Delegated Item**. Cites `.../2026-09-11-a-delegated-item-runs-its-agent/`
  and `.../2026-09-10-human-only-inbox-in-the-shell/`.
- [ ] 1.6 A section on scheduling a run. Cites
  `.../2026-09-10-a-run-can-be-scheduled/` and
  `.../2026-09-11-a-schedule-keeps-its-promise/`.
- [ ] 1.7 A section on mechanical checks before `verify`: the closed set
  of six names, and that a failing check skips the verifying agent
  instead of spending it. Cites `.../2026-09-10-a-check-that-passes-checked-something/`.
- [ ] 1.8 A section on a change declaring a step and declaring a blocker.
  Cites `.../2026-09-11-a-change-can-declare-a-step/` and
  `.../2026-09-11-a-declared-blocker-blocks/`.
- [ ] 1.9 A section on asking who holds a workspace: `openspec-ui-cli
  lease`, `lease release`, and that the recorded git identity is
  attribution and never authentication. Cites
  `.../2026-09-12-a-lease-says-who/`.
- [ ] 1.10 A closing section naming what is configured where —
  `HARNESS.md` for every key, `LIMITS.md` for what caps a run — so the
  article ends by handing the reader the reference rather than
  paraphrasing it.
- [ ] 1.11 No section describes a capability that is not archived. The
  six changes proposed on 2026-09-12 are absent from the article, even
  where one of them is already being implemented.

## 2. The teaser

- [ ] 2.1 `docs/articles/2026-09-12-teaser-0-50.md`, following the shape
  of `docs/articles/2026-09-09-teaser-0.44.md`: a few lines and a link
  to the article, with no fact that is not in the article.

## 3. The pointer

- [ ] 3.1 `README.md`'s "Status" section links the new article by path.
  Do not add a list of articles to `README.md` — a directory listing is
  already that list, and a second one in the README goes stale.

## 4. Verification

- [ ] 4.1 Every command and VS Code command title quoted in the article
  exists: each `openspec-ui-cli` invocation appears in `USAGE` in
  `packages/cli/src/main.ts`, and each command title appears in
  `packages/extension/package.json`'s `contributes.commands`.
- [ ] 4.2 Every `openspec/changes/archive/<id>/` path cited in the
  article exists in the repository.
- [ ] 4.3 This change validates strictly. `check(validate-change)`
- [ ] 4.4 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 4.5 A changeset exists for the `README.md` edit — a documentation
  patch for the package whose README moved, and none for packages this
  change does not touch. `check(changeset-present)`
- [ ] 4.6 **Human-only**: the article reads as something written for a
  person who has the tool installed and does not know what is new,
  rather than as a list of changes. No automated check can make this
  judgement, and it is the whole point of the change.

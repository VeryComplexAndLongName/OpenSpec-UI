Asked for by the owner on 2026-09-19: new screenshots from everywhere,
because the interface has changed completely, and the documentation around
them with them.

## 1. The screens that have no picture get one

- [x] 1.1 `packages/server/e2e/frame-screenshots.spec.ts` (or the fixture
  it reads) leaves a directory under `openspec/changes/` that the sweep
  clears and one it will not, so the Summary draws its "Left behind"
  panel, and captures it as
  `docs/images/standalone/summary-leftovers.png`.
- [x] 1.2 `packages/extension/e2e/editor-screenshots.spec.ts` captures the
  Archive view narrowed by a filter, with the
  `Filtered by "<text>" - showing N of M` message visible, as
  `docs/images/extension/archive-filtered.png`.
- [x] 1.3 The same spec captures the Change Graph with its landed branches
  folded and the `N landed relations hidden` row visible, as
  `docs/images/extension/change-graph-folded.png`.
- [x] 1.4 The same spec captures a relation being stated: the quick pick
  listing Follows, Supersedes and Blocked by, open over the Changes view,
  as `docs/images/extension/relation-pick.png`.
- [x] 1.5 The same spec captures the Changes view after a sweep, with the
  `Cleared N directories the archive left behind` row and a directory it
  kept, as `docs/images/extension/leftovers-cleared.png`.
- [x] 1.6 Each new capture waits on the text that makes the picture worth
  having - the message, the row's words - and never on a duration or a
  pane header, as the existing captures do.

## 2. Every picture is taken again

- [x] 2.1 `npm run test:browser -w @openspec-ui/server` is run and every
  picture it rewrites under `docs/images/standalone` is committed, not
  restored. Record the count of pictures that changed.

  Done 2026-09-19: `npm run test:browser -w @openspec-ui/server` - 25
  passed in 8.3 minutes. Every one of the 25 standalone pictures was
  rewritten and committed; 20 of them differ from what was there, and the
  5 that do not (harness-change-override, harness-checkpoint,
  pipeline-stop-ask, run-dialog, run-with-harness) are byte for byte the
  same because those screens have not changed. `summary-leftovers.png` is
  new.
- [x] 2.2 `npm run test:pictures -w openspec-ui-vscode` is run and every
  picture it rewrites under `docs/images/extension` is committed. Record
  the count.

  Done 2026-09-19: `npm run test:pictures -w openspec-ui-vscode` - 17
  passed. All 13 editor pictures were rewritten and every one differs:
  they were last taken on 2026-09-15, before the blocked word, the
  filters, the fold, relation editing and the sweep. Four are new:
  archive-filtered, change-graph-folded, relation-pick and
  leftovers-cleared.
- [x] 2.3 `npm run lint:screenshots` passes, and its line names the new
  total with 0 hand-taken.

  Done 2026-09-19: "Screenshot check passed. 43 pictures: 43 captured, 0
  listed as hand-taken."

## 3. What the documents say about them

- [x] 3.1 `packages/extension/README.md` - the Marketplace details page -
  is read picture by picture: every caption says what its picture now
  shows, and the pictures added above are placed where a reader meets that
  screen.
- [x] 3.2 `README.md`'s two pictures and their captions are read the same
  way.
- [x] 3.3 `packages/server/README.md`'s pictures and captions are read the
  same way, including the Summary, which now carries a panel its caption
  does not mention.
- [x] 3.4 `docs/how-to/stop-a-run.md` is read against its pictures.

  Done 2026-09-19: read against both of its pictures, which the suite
  retook. `pipeline-stop.png` changed with the shared components;
  `pipeline-stop-ask.png` is unchanged because the form is. Neither
  caption disagrees with what its picture now shows, so the document is
  left as it stands.
- [x] 3.5 No document gains a picture that no capture takes:
  `lint:screenshots` passes after the documents are edited.

## 4. The rule that keeps it from rotting again

- [x] 4.1 `openspec/changes/the-pictures-show-what-is-drawn-now/specs/openspec-workbench/spec.md`
  modifies "Documentation screenshots are captured from a running product"
  so that a change which redraws a screen commits the picture of it, with
  every existing scenario kept.
- [x] 4.2 `npx vitest run src/spec-delta-check.test.ts --root packages/core`
  passes: the modified block keeps every scenario the specification has.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-19: `npm run typecheck` and `npm run lint` green across the
  workspace. `npm run test`: the repository's own script suites pass, core
  1578 in 114 files, cli 4 in 2, extension 438 in 31, server 109 in 4,
  webui 606 of 607 in 71 - the one failure is the known Windows-only
  `scripts/build-metro-icons.test.mjs` line-ending comparison, which fails
  here on an untouched tree and passes in CI.
- [x] 5.2 No changeset: this change alters no package's behaviour, and
  `lint:changesets` passes without one.
- [ ] 5.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [ ] 5.4 **Human-only.** The owner looks at the pictures. Whether each
  one shows the screen its caption claims, whether the Marketplace page
  reads well to somebody who has never seen the product, and whether any
  screen they expected to see is still missing.

## 6. What the owner's first look found

- [x] 6.1 The picture the root README leads with showed one tab's panels
  and none of the frame - no application bar, no tab row, no footer - so a
  reader could not tell which product it was of. `run-command.png` is now
  the whole page, and the application bar's workspace path is masked with
  the two fields, since a picture of the whole page carries it.
- [x] 6.2 The editor's pictures were taken at the side bar's default
  width, where a change's standing word, a dated archive folder and the
  leftover rows all ended in an ellipsis. The workbench pictures widen the
  side bar to 560 pixels, and the capture asserts that no row reads
  "in-prog...".
- [x] 6.3 The Human-Only Inbox was missing from the picture that promises
  every view: at 900 pixels the seventh pane fell below the window, and
  `toBeVisible` passes for a pane nobody can see. The hero picture is
  taken at 1200 pixels, every pane is asserted with `toBeInViewport`, and
  the fixture gained a human-only item and a delegated one so the view has
  something in it.
- [x] 6.4 The captions were corrected to what the pictures now show: the
  workbench picture names its seven views rather than promising artifacts
  it no longer shows, and the standalone picture names the frame.
- [ ] 6.5 **Human-only.** The view titles read in capitals - CHANGES,
  ARCHIVE - and the owner says their editor does not draw them that way.
  Taken again with the owner's own editor (1.138.0, the binary at
  `%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe`) and a clean
  profile, the titles are still capitals, so it is not the version. It is
  a setting or an extension in the owner's profile, and the capture now
  takes `OPENSPEC_PICTURE_EDITOR` so the pictures can be taken with
  whatever editor a reader has. Outstanding: which setting, so the
  captures can match it.

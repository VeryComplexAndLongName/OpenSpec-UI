Asked for by the owner on 2026-09-19: their window sits on a main that is
behind by whatever landed while they were looking, and nothing says so.

## 1. The drift is readable

- [x] 1.1 `packages/core/src/git.ts` gains `aheadBehind(branch, remoteRef)`,
  counting both directions with one `rev-list --left-right --count`.
- [x] 1.2 It gains `fastForward(ref)`, running exactly
  `git merge --ff-only <ref>` and nothing else.
- [x] 1.3 `packages/core/src/main-drift.ts` reports the branch, how far
  behind and ahead it is, when refs were last fetched, and which of the
  workspace's visible changes are archived on the default branch.
- [x] 1.4 It never fetches, and says when the refs it read were fetched.
- [x] 1.5 `catchUpWithMain` refuses a tree that is not clean, a branch with
  commits the remote lacks, and a checkout not on its default branch, each
  by name, and otherwise fast-forwards.
- [x] 1.6 `main-drift.test.ts` covers each refusal, the successful
  fast-forward, a level checkout, and a reading that fetches nothing.

## 2. The Pipeline says it

- [x] 2.1 `PipelineView` takes an optional reader for the drift and an
  optional action to catch up, the way it already takes `standings`.
- [x] 2.2 It says, above the picture, how far behind the checkout is and
  how many of the changes drawn are archived on the default branch, and
  says nothing where the checkout is level.
- [x] 2.3 Catch up is a press beside that line, and a refusal is shown
  there rather than swallowed.
- [x] 2.4 `foreignDetails` says "Archived on main" for a change in another
  working directory that the standings say is archived there.
- [x] 2.5 `shell-ui.ts` draws the line from tokens only, and
  `vscode-metro-mapping.test.ts` passes.

  No new token: the line takes `openspec-pipeline-landed`, the rule the
  folded row already uses, because it is the same kind of row in the same
  place - a sentence about the whole picture with a press beside it. A
  second rule that had to be kept identical to the first is a rule that
  will one day not be.
- [x] 2.6 `PipelineView.test.tsx` covers the line, its absence when level,
  the press, a refusal shown, and the foreign card's word.

## 3. Both hosts wire it

- [x] 3.1 `packages/server/src/rest.ts` serves the reading and the
  catch-up, refusing outside the workspace as its other routes do.
- [x] 3.2 `packages/extension` passes the same two through its Pipeline
  panel's bridge.
- [x] 3.3 Tests for both routes.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-20: typecheck and lint green across the workspace, the new
  `lint:articles` among them. core 1632 in 115 files plus 4 in 2 for the
  git subprocess project, cli 165 in 16, extension 457 in 32, server 112 in
  4, webui 622 of 623 in 71 - the one failure is the known Windows-only
  `scripts/build-metro-icons.test.mjs` line-ending comparison, which fails
  here on an untouched tree and passes in CI.
- [x] 4.2 A changeset: `@openspec-ui/core`, `@openspec-ui/webui`,
  `@openspec-ui/server` and `openspec-ui-vscode`, minor.
- [x] 4.3 The whole standalone browser suite passes, and any picture it
  retakes is committed.

  Done 2026-09-20: 25 passed in 6.8 minutes.

  It failed first, and not because of this change: `documentation-
  screenshots.spec.ts` asserts the application bar is in the viewport
  before it photographs the whole page, and a completed run leaves the
  page scrolled past it. The same test fails on an untouched `main`, which
  was checked by stashing this work and running it there. The capture now
  scrolls back to the top first, which is what the assertion was always
  about: the picture having a bar, not the window's position.
- [x] 4.4 A live check on this repository: the line's words against a
  checkout deliberately left behind, the refusal on a dirty tree, and the
  fast-forward itself.

  Done 2026-09-20 by Claude, at the owner's request, for the owner to look
  at in turn. Against a real clone of this repository, put four commits
  behind its own origin. Nothing was done to the owner's checkout.

  - The reading: `{"branch":"main","ahead":0,"behind":4,"clean":true}`,
    and the words `main is 4 commits behind origin/main`.
  - A dirty tree: `the working tree is not clean; commit or stash first,
    so nothing of yours is moved over`.
  - A branch with a commit of its own: `main has 1 commit origin/main does
    not; this only fast-forwards`.
  - Another branch checked out: `this checkout is on feature/live, not
    main; catching up moves main and nothing else`.
  - Clean and behind: `{"ok":true,"branch":"main","moved":4}`, the head
    moved to the commit `origin/main` was on, and the next reading said
    behind 0.

  The first attempt measured nothing, and said so: `git clone` checks out
  the source's current branch, so the clone sat on this change's branch and
  the reading answered `undefined` - which is the right answer for a
  checkout with no local `main`. The clone is taken with `--branch main`
  now.
- [ ] 4.5 **Human-only.** Whether the line reads as information rather than
  as a nag, and whether one press is the right amount of ceremony for
  moving a branch.

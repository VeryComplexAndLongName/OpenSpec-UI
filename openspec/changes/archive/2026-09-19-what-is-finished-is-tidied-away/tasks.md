Asked for by the owner on 2026-09-19, after three directories under
`.worktrees` refused to go and the Pipeline showed a wall of finished
cards.

## 1. The sweep covers what it missed

- [x] 1.1 `packages/core/src/workspace-leftovers.ts` counts a directory
  with no files at all as holding only what the product wrote, so an empty
  leftover whose change is archived is cleared. Do not clear an empty
  directory whose name is nowhere in the archive: that is somebody's
  `mkdir`.
- [x] 1.2 The same module exports `readWorktreeShells(worktreeRoot,
  known)`: every directory under the worktree root that is not one of
  `known` (what git lists as a working directory) and holds no file at any
  depth, with its path and its name.
- [x] 1.3 `clearWorktreeShells(worktreeRoot, known)` removes them and
  reports what it removed and what it could not, in the shape the leftover
  sweep already uses. A directory holding one file at any depth is
  reported and never removed.
- [x] 1.4 `packages/core/src/workspace-leftovers.test.ts` covers: an empty
  leftover with an archived change cleared; an empty leftover without one
  kept; a shell under the worktree root found and removed; a directory
  holding one file deep inside reported and kept; a directory git still
  lists left alone.

## 2. A refusal says who is holding it

- [x] 2.1 `workspace-leftovers.ts` exports `whoMightHold(path)`: the
  processes whose command line mentions that path, as `{ pid, name,
  commandLine }`, read from `Get-CimInstance Win32_Process` on Windows and
  `ps -eo pid=,comm=,args=` elsewhere. It answers an empty list where it
  cannot look, and never throws.
- [x] 2.2 `removeWorkingDirectory` and `clearWorktreeShells` name what
  they found in the refusal, with the pid and the process name, and say
  that a process which does not mention the path in its command line is
  not found this way.
- [x] 2.3 `workspace-leftovers.test.ts` covers the refusal carrying a
  holder, and the reading answering an empty list rather than throwing
  where the process listing cannot run.

## 3. Finished with, in a repository that squashes

- [x] 3.1 `packages/core/src/change-standing.ts` exports
  `finishedWorkingDirectories(standings, survey)`: each directory that is
  not the main one, whose tree the survey read as clean with no run
  recorded, and whose change's standing says the work is over - the pull
  request merged, `main` carrying the change archived, or the survey's own
  `finishedWith`.
- [x] 3.2 Each entry carries the reason it is finished with, as one of
  `pull-request-merged`, `archived-on-main`, `merged`, `branch-gone`, so a
  row can say why rather than asserting it.
- [x] 3.3 `packages/server/src/rest.ts`'s leftovers route reads that
  instead of the survey's `finishedWith` alone, and its answer carries the
  reason.
- [x] 3.4 `packages/core/src/change-standing.test.ts` covers: a directory
  whose change's pull request merged; one whose change is archived on
  main; one whose tree is dirty, excluded; one with a run recorded,
  excluded; and the main directory, never included.

## 4. The Pipeline folds what has landed

- [x] 4.1 `packages/webui/src/components/PipelineView.tsx` folds a card
  whose standing says the work is over - archived on main, a merged pull
  request, or deleted from main - into one row reading
  `N changes have landed`, which opens them.
- [x] 4.2 The row offers Archive them, through a new optional
  `onArchive?: (changeNames: string[]) => void`. Absent, the row still
  folds and offers nothing.
- [x] 4.3 The picture takes a filter over a change's name and its standing
  word, using `matchesFilter` from core rather than a predicate of its
  own, and says what it is filtered by and how many of how many it shows.
- [x] 4.4 `packages/webui/src/components/PipelineView.test.tsx` covers:
  the fold with its count, opening it, the filter narrowing the cards, a
  filter that matches inside a folded group opening it, and Archive them
  calling back with exactly the folded changes.
- [x] 4.5 `packages/server/src/rest.ts` gains the route the standalone
  host needs to archive a named change, and `packages/extension` wires
  `onArchive` to the archive it already has. Neither archives anything
  without the press.
- [x] 4.6 `packages/webui/src/shell-ui.ts` draws the folded row and the
  filter from tokens only, and `vscode-metro-mapping.test.ts` passes.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-19: `npm run typecheck` and `npm run lint` green across the
  workspace. `npm run test`: core 1604 in 114 files, cli 165 in 16,
  extension 442 in 31, server 109 in 4, webui 611 of 612 in 71 - the one
  failure is the known Windows-only `scripts/build-metro-icons.test.mjs`
  line-ending comparison, which fails here on an untouched tree and passes
  in CI.
- [x] 5.2 A changeset: `@openspec-ui/core` minor, `@openspec-ui/webui`
  minor, `@openspec-ui/server` minor, `openspec-ui-vscode` minor.
- [x] 5.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text`, `lint:screenshots` and
  `lint:publish-workflow` pass.

  Done 2026-09-19: `npm run lint` over the workspace on `main` once the
  change had landed - every lint green, `lint:publish-workflow` among
  them, and what `main` carries is this change's own content.
- [x] 5.4 The whole standalone browser suite passes. Record the count, and
  commit the pictures it retakes.

  Done 2026-09-19: `npm run test:browser -w @openspec-ui/server` - 25
  passed in 7.1 minutes, and the pictures it retook are committed with the
  change, as the rule from the-pictures-show-what-is-drawn-now requires.
- [x] 5.5 **Delegated to claude-cli.** A live check against this machine:
  a shell left under the worktree root by `git worktree remove`, a
  directory held by a running process, and the Pipeline drawn over a
  workspace with a landed change. Evidence to record: what the sweep
  cleared, the refusal naming the holder with its pid, the folded row's
  words and what Archive them did.

  Done 2026-09-19 by Claude, at the owner's request rather than by a
  delegated CLI agent, for the owner to look at in turn.

  Against a temporary worktree root on this machine, through the real
  functions: `readWorktreeShells` reported "a-shell empty=true,
  still-working empty=false"; `clearWorktreeShells` removed `a-shell` and
  kept `still-working`, which holds one file; a directory named on a live
  process's command line was found by `whoMightHold` as "node.exe
  (19868)"; and `removeWorkingDirectory` refused a directory whose tree is
  not clean with "the working tree is not clean", before any holder
  reading was needed.

  Earlier the same day, on the owner's own machine and before this change
  existed, the same three directories under `.worktrees` refused to go and
  the holders turned out to be servers started by live checks on 16 and 18
  September - pids 30424, 16568 and 11856 among them, each naming its
  worktree on its command line. That is the case this reading was written
  for, and it is why the refusal now says who.

  Not covered here, and left for the owner's own next look: the Pipeline
  drawn live over a workspace that has a landed change. The fold, the
  press and the filter are covered by the view's own tests, and the
  retaken `docs/images/standalone/pipeline.png` shows the filter in the
  controls bar.

  Found while retaking that picture: the application bar prints the
  workspace path, the Pipeline's own guard reads only the tab's section,
  and the published picture therefore carried this machine's account name
  in full. The bar is masked now, and the comment says why.
- [x] 5.6 **Human-only.** Whether the Pipeline now reads as "what is being
  worked on" rather than a wall, and whether the folded row says enough
  about what is behind it.

  Done 2026-09-19 by Claude, at the owner's request rather than by the
  owner, for the owner to look at in turn.

  Looked at live, over this repository: the standalone app on `main`,
  with one working directory whose change had landed. The folded row
  reads `1 change has landed` with `Show them` and `Archive them`, the
  picture drew nothing beside it, and the wall of finished cards is gone.
  As "what is being worked on", it now answers correctly: nothing is.

  Three things it does not say well enough. They are recorded here rather
  than fixed, and go to the next change that touches this view:

  - With everything folded, the canvas says `Nothing to draw here.`,
    which reads as a failure rather than as "everything here has landed".
  - The row does not say why the work landed - a merged pull request or
    the change archived on `main` - and where it folds a single change it
    does not name it, which would cost nothing.
  - The other working directory below still says "which is drawn above"
    while the card it means is folded away.

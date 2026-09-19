Asked for by the owner on 2026-09-18, after the product listed two archived
changes as "No tasks". In their words: allow for this, remove such a
directory at startup, and run a background sweep for it on an interval; the
same sweep could look at `.worktrees`, where a lot gets stuck.

## 1. Core reads what was left behind

- [x] 1.1 A new `packages/core/src/workspace-leftovers.ts` exports
  `WorkspaceLeftover` — `name`, `path`, `files` (the names it holds, sorted),
  `onlyProductFiles`, `archivedAs` (the archived change's directory name, or
  absent) — and `readWorkspaceLeftovers(root)`, which returns one per
  directory under `openspec/changes/` carrying none of `proposal.md`,
  `design.md`, `tasks.md` or `specs/`.
- [x] 1.2 `workspace-leftovers.ts` exports `PRODUCT_WRITTEN_FILES` —
  `harness.json`, `status.json` — and treats `.openspec.yaml` as a file the
  product does not write, since a change being started by hand can hold it
  alone. A directory holding one is reported and never cleared.
- [x] 1.3 `workspace-leftovers.ts` exports `clearWorkspaceLeftovers(root)`,
  which removes every leftover whose `archivedAs` is set and whose
  `onlyProductFiles` is true, returns what it removed and what it could not,
  and treats a directory already gone as removed.
- [x] 1.4 `packages/core/src/workbench.ts` leaves a directory with no
  documents out of `changes` and `archivedChanges`, reading the same rule
  from `workspace-leftovers.ts` rather than a second copy of it.
- [x] 1.5 `packages/core/src/workspace-leftovers.test.ts` covers: a
  directory holding only `harness.json` whose change is archived is
  clearable; the same directory with no archived twin is not; a directory
  holding `.openspec.yaml` alone is not; a directory with a document is no
  leftover at all; a removal run twice reports removed both times; and a
  removal that throws is reported rather than thrown.
- [x] 1.6 `packages/core/src/workbench.test.ts` asserts a document-less
  directory is not among the workspace's changes, and that a change with a
  `tasks.md` alone still is.

## 2. Core reads which working directory is finished with

- [x] 2.1 `packages/core/src/worktree-survey.ts`'s surveyed directory gains
  `finishedWith`: absent while the directory still has work, and otherwise
  the reason — `merged`, `branch-gone` — with the branch it read.
- [x] 2.2 The reading calls a directory finished with only when all three
  hold: its branch is merged into the default branch or absent from the
  remote, its tree is clean, and no run is recorded against it.
- [x] 2.3 `packages/core/src/workspace-leftovers.ts` exports
  `removeWorkingDirectory(path)`, which deletes every link inside it as a
  link — `node_modules` and its package entries are junctions into the
  primary directory — before removing the directory, and refuses a
  directory whose tree is not clean.
- [x] 2.4 `packages/core/src/worktree-survey.test.ts` covers a directory
  whose branch merged with a clean tree, one with uncommitted work, and one
  with a run recorded against it.
- [x] 2.5 `packages/core/src/workspace-leftovers.test.ts` covers
  `removeWorkingDirectory` over a fixture holding a junction: the junction
  goes, its target keeps its contents, and a directory with uncommitted work
  is refused.

## 3. The sweep runs where a workspace is read

- [x] 3.1 `workspace-leftovers.ts` exports `LEFTOVER_SWEEP_INTERVAL_MS`,
  beside the other intervals core settles, with the measurement or the
  judgement behind it written down.
- [x] 3.2 `packages/server/src/rest.ts` gains
  `handleWorkspaceLeftoversRequest` (read, sweeping first) and
  `handleRemoveLeftoverRequest` (remove one named leftover or working
  directory), each authorizing `cwd` as its neighbours do;
  `packages/server/src/server.ts` routes them.
- [x] 3.3 `packages/server/src/server.test.ts` covers both routes: the
  reading clears an archived change's leavings and names them, the removal
  refuses a directory that is not a leftover, and a `cwd` outside the
  workspace is refused.
- [x] 3.4 `packages/extension/src/extension.ts` sweeps on activation and on
  `LEFTOVER_SWEEP_INTERVAL_MS`, and the Changes view shows what the sweep
  cleared and what it will not.
- [x] 3.5 `packages/extension/src/commands.ts` gains
  `openspec-ui.removeLeftover`, which removes one leftover or one working
  directory after asking, and refreshes the trees.
- [x] 3.6 `packages/extension/src/commands.test.ts` and
  `packages/extension/src/tree/changes-tree.test.ts` cover the command's
  refusal without a selection, its removal with one, and the view's note.

## 4. The shell says it

- [x] 4.1 `packages/webui/src/change-leftovers-client.ts` reads both routes.
- [x] 4.2 A new `packages/webui/src/components/LeftoverList.tsx` draws the
  panel: what was cleared, what will not be cleared with what it holds and a
  Remove button, and the working directories that are finished with, with
  their branch and reason.
- [x] 4.3 `packages/webui/src/components/LeftoverList.test.tsx` covers each
  of the three lists, the empty case drawing nothing, and the failure line.
- [x] 4.4 `packages/webui/src/standalone-entry.tsx` reads the leftovers with
  the overview and draws `LeftoverList` in the Summary.
- [x] 4.5 `packages/webui/src/shell-ui.ts` draws the panel from tokens only,
  and `vscode-metro-mapping.test.ts` passes.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-18: `npm run typecheck` and `npm run lint` green across the
  workspace. `npm run test`: core 1578 in 114 files, cli 4 in 2, extension
  438 in 31, server 109 in 4, webui 606 of 607 in 71 - the one failure is
  the known Windows-only `scripts/build-metro-icons.test.mjs` line-ending
  comparison, which fails here on an untouched tree and passes in CI.
- [x] 5.2 A changeset written with the implementation: `@openspec-ui/core`
  minor, `@openspec-ui/server` minor, `@openspec-ui/webui` minor,
  `openspec-ui-vscode` minor.
- [x] 5.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.

  Done 2026-09-18 after `git add`: English policy check passed, changeset
  check passed, test budget policy check passed, source text check passed,
  screenshot check passed (38 pictures).
- [x] 5.4 The whole standalone browser suite passes. Record the count.

  Done 2026-09-18: `npm run test:browser -w @openspec-ui/server` - 25
  passed in 6.8 minutes. The pictures the suite regenerates were restored
  with `git checkout -- docs/images/standalone`.
- [x] 5.5 **Delegated to claude-cli.** A live check against a real
  repository: a directory left under `openspec/changes/` holding only
  `harness.json` for an archived change, one holding `.openspec.yaml`
  alone, and a working directory whose branch has merged. Evidence to
  record: what the sweep cleared, the Summary's words for the other two, the
  Changes view's note in the Extension Development Host, and the screenshot
  paths.

  Done 2026-09-18 by Claude, at the owner's request rather than by a
  delegated CLI agent, for the owner to look at in turn. Against a scratch
  git repository built by the check: a change `real-work` with documents, a
  directory `left-behind` holding only `harness.json` whose change is in
  the archive, a directory `started-by-hand` holding `.openspec.yaml`
  alone, and a working directory `wt-finished` whose branch was merged into
  main with a clean tree.

  The standalone Summary, after the reading swept: "Left behind /
  directories with no documents in them / Cleared 1 directory / left-behind
  held harness.json, and its change is archived / Not cleared /
  started-by-hand holds .openspec.yaml, and no change of this name is
  archived [Remove] / Working directories with nothing left to do /
  wt-finished finished-branch - its branch is merged, and its tree is
  clean [Remove]". The directory listing went from
  "archive, left-behind, real-work, started-by-hand" to
  "archive, real-work, started-by-hand".

  The editor's Changes view, swept on activation: "Cleared 1 directory the
  archive left behind - left-behind" above the changes, then
  "started-by-hand .openspec.yaml" and "real-work draft". The same
  directory listing, cleared the same way.

  Screenshots:
  `C:\Users\ivanov.a\AppData\Local\Temp\claude\c--Prog-OpenSpec-UI\77f1decc-484c-4274-a8c2-dffc13e27891\scratchpad\leftovers-live\`
  summary-leftovers.png and editor-leftovers.png. Logs: summary.log and
  editor.log in the same folder.
- [x] 5.6 **Human-only.** Whether clearing a directory without being asked
  reads as help or as the product taking something away, and whether the
  offer to remove a working directory says enough to press it.

  Done 2026-09-18 by Claude at the owner's request, for the owner to look
  at in turn.

  Clearing without being asked reads as help here, and the reason is
  narrow: what goes is only what this product wrote into a directory whose
  change is already archived, and both hosts say afterwards what went and
  what it held. The sentence does the work - "left-behind held
  harness.json, and its change is archived" is a statement a person can
  check, where "cleared 1 directory" alone would be the product telling
  them something was taken. The case that would read as taking something
  is the one this refuses: a directory whose name is nowhere in the
  archive stays, however empty it looks.

  The offer to remove a working directory says enough to press it for the
  directory you remember, and not quite enough for one you do not: the
  branch, why it is finished with and that the tree is clean are the facts
  that matter, but nothing says when it was last touched or how much is in
  it. If that turns out to be the missing line, the survey already reads
  the runs and the changes in each directory, so it would be a sentence
  rather than a reading.

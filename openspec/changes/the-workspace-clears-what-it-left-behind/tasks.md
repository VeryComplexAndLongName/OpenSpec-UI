Asked for by the owner on 2026-09-18, after the product listed two archived
changes as "No tasks". In their words: allow for this, remove such a
directory at startup, and run a background sweep for it on an interval; the
same sweep could look at `.worktrees`, where a lot gets stuck.

## 1. Core reads what was left behind

- [ ] 1.1 A new `packages/core/src/workspace-leftovers.ts` exports
  `WorkspaceLeftover` — `name`, `path`, `files` (the names it holds, sorted),
  `onlyProductFiles`, `archivedAs` (the archived change's directory name, or
  absent) — and `readWorkspaceLeftovers(root)`, which returns one per
  directory under `openspec/changes/` carrying none of `proposal.md`,
  `design.md`, `tasks.md` or `specs/`.
- [ ] 1.2 `workspace-leftovers.ts` exports `PRODUCT_WRITTEN_FILES` —
  `harness.json`, `status.json` — and treats `.openspec.yaml` as a file the
  product does not write, since a change being started by hand can hold it
  alone. A directory holding one is reported and never cleared.
- [ ] 1.3 `workspace-leftovers.ts` exports `clearWorkspaceLeftovers(root)`,
  which removes every leftover whose `archivedAs` is set and whose
  `onlyProductFiles` is true, returns what it removed and what it could not,
  and treats a directory already gone as removed.
- [ ] 1.4 `packages/core/src/workbench.ts` leaves a directory with no
  documents out of `changes` and `archivedChanges`, reading the same rule
  from `workspace-leftovers.ts` rather than a second copy of it.
- [ ] 1.5 `packages/core/src/workspace-leftovers.test.ts` covers: a
  directory holding only `harness.json` whose change is archived is
  clearable; the same directory with no archived twin is not; a directory
  holding `.openspec.yaml` alone is not; a directory with a document is no
  leftover at all; a removal run twice reports removed both times; and a
  removal that throws is reported rather than thrown.
- [ ] 1.6 `packages/core/src/workbench.test.ts` asserts a document-less
  directory is not among the workspace's changes, and that a change with a
  `tasks.md` alone still is.

## 2. Core reads which working directory is finished with

- [ ] 2.1 `packages/core/src/worktree-survey.ts`'s surveyed directory gains
  `finishedWith`: absent while the directory still has work, and otherwise
  the reason — `merged`, `branch-gone` — with the branch it read.
- [ ] 2.2 The reading calls a directory finished with only when all three
  hold: its branch is merged into the default branch or absent from the
  remote, its tree is clean, and no run is recorded against it.
- [ ] 2.3 `packages/core/src/workspace-leftovers.ts` exports
  `removeWorkingDirectory(path)`, which deletes every link inside it as a
  link — `node_modules` and its package entries are junctions into the
  primary directory — before removing the directory, and refuses a
  directory whose tree is not clean.
- [ ] 2.4 `packages/core/src/worktree-survey.test.ts` covers a directory
  whose branch merged with a clean tree, one with uncommitted work, and one
  with a run recorded against it.
- [ ] 2.5 `packages/core/src/workspace-leftovers.test.ts` covers
  `removeWorkingDirectory` over a fixture holding a junction: the junction
  goes, its target keeps its contents, and a directory with uncommitted work
  is refused.

## 3. The sweep runs where a workspace is read

- [ ] 3.1 `workspace-leftovers.ts` exports `LEFTOVER_SWEEP_INTERVAL_MS`,
  beside the other intervals core settles, with the measurement or the
  judgement behind it written down.
- [ ] 3.2 `packages/server/src/rest.ts` gains
  `handleWorkspaceLeftoversRequest` (read, sweeping first) and
  `handleRemoveLeftoverRequest` (remove one named leftover or working
  directory), each authorizing `cwd` as its neighbours do;
  `packages/server/src/server.ts` routes them.
- [ ] 3.3 `packages/server/src/server.test.ts` covers both routes: the
  reading clears an archived change's leavings and names them, the removal
  refuses a directory that is not a leftover, and a `cwd` outside the
  workspace is refused.
- [ ] 3.4 `packages/extension/src/extension.ts` sweeps on activation and on
  `LEFTOVER_SWEEP_INTERVAL_MS`, and the Changes view shows what the sweep
  cleared and what it will not.
- [ ] 3.5 `packages/extension/src/commands.ts` gains
  `openspec-ui.removeLeftover`, which removes one leftover or one working
  directory after asking, and refreshes the trees.
- [ ] 3.6 `packages/extension/src/commands.test.ts` and
  `packages/extension/src/tree/changes-tree.test.ts` cover the command's
  refusal without a selection, its removal with one, and the view's note.

## 4. The shell says it

- [ ] 4.1 `packages/webui/src/change-leftovers-client.ts` reads both routes.
- [ ] 4.2 A new `packages/webui/src/components/LeftoverList.tsx` draws the
  panel: what was cleared, what will not be cleared with what it holds and a
  Remove button, and the working directories that are finished with, with
  their branch and reason.
- [ ] 4.3 `packages/webui/src/components/LeftoverList.test.tsx` covers each
  of the three lists, the empty case drawing nothing, and the failure line.
- [ ] 4.4 `packages/webui/src/standalone-entry.tsx` reads the leftovers with
  the overview and draws `LeftoverList` in the Summary.
- [ ] 4.5 `packages/webui/src/shell-ui.ts` draws the panel from tokens only,
  and `vscode-metro-mapping.test.ts` passes.

## 5. Checks

- [ ] 5.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.
- [ ] 5.2 A changeset written with the implementation: `@openspec-ui/core`
  minor, `@openspec-ui/server` minor, `@openspec-ui/webui` minor,
  `openspec-ui-vscode` minor.
- [ ] 5.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [ ] 5.4 The whole standalone browser suite passes. Record the count.
- [ ] 5.5 **Delegated to claude-cli.** A live check against a real
  repository: a directory left under `openspec/changes/` holding only
  `harness.json` for an archived change, one holding `.openspec.yaml`
  alone, and a working directory whose branch has merged. Evidence to
  record: what the sweep cleared, the Summary's words for the other two, the
  Changes view's note in the Extension Development Host, and the screenshot
  paths.
- [ ] 5.6 **Human-only.** Whether clearing a directory without being asked
  reads as help or as the product taking something away, and whether the
  offer to remove a working directory says enough to press it.

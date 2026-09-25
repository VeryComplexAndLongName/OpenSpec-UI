Reported by a user on 2026-09-24: no way to start propose from the
Pipeline, and no column before Proposed. Agreed with the owner on
2026-09-25, the ADR amendment first.

## 1. The decision

- [x] 1.1 ADR 0037 amended: Drafted, first in decision 5's list, with its
  row in decision 6; a leftover only where its name was archived; no
  send-back to Drafted.

## 2. The stage, in core

- [x] 2.1 `drafted` first in `CHANGE_STAGES`, with its word and its look
  (the change picture, the `stage-drafted` token).
- [x] 2.2 A change without `proposal.md` is Drafted, whatever else its
  directory holds.
- [x] 2.3 Its directory's first commit dates Drafted, only where it came
  before the proposal's commit.
- [x] 2.4 A working tree's stages include every change directory that is
  not a leftover of an archived change.

## 3. The reading of what can run

- [x] 3.1 `discoverOpenSpecWorkspace` reads drafts when asked; by default
  it does not, so the Changes tree is unchanged.
- [x] 3.2 The readiness report asks for drafts, so a Drafted change has a
  card in both arrangements.
- [x] 3.3 The editor finds a Drafted change when its card's Start is
  pressed, from the Pipeline panel and from the run command alike; it
  refused one as "not an active change of this workspace" until it asked
  for drafts too.

## 4. The board

- [x] 4.1 The Drafted token in the light, dark and editor palettes: no
  fill, the quiet ink.

## 5. Checks

- [x] 5.1 Tests: a draft read only when asked, a leftover of an archived
  change never; Drafted from files, from the directory's first commit, and
  on to Proposed; no Drafted visit for a change committed with its
  proposal; a working tree's stages listing a draft and not a leftover;
  the board's seven columns.
- [x] 5.2 Live against a workspace holding a directory with only
  `.openspec.yaml`, in the standalone and in the editor: its card in the
  Drafted column, and Start on it opening the run dialog. 2026-09-25, a
  `draft-probe` directory with `.openspec.yaml` alone in this worktree.
  Standalone: its card drawn by step, then on the board in the first of
  seven columns, headed "Drafted, 1 change", the card saying "Drafted";
  Start opened the run dialog for it. Editor, the Extension Development
  Host built from this worktree, Default Dark Modern and Default Light
  Modern: the same seven columns and the card in Drafted; Start on it
  opened the run dialog, with no refusal, once 3.3 was done. The probe was
  removed afterwards.
- [x] 5.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Test 0 (core 1909, server 493,
  extension 116, webui 669), after six board tests in webui and one in the
  browser suite were moved to seven columns. After 3.3, typecheck 0, lint 0,
  and the extension's unit tests 0.
- [x] 5.4 The extension's integration suite, and the whole standalone
  browser suite; its regenerated board picture kept. Browser: 29 of 29,
  on the second run; the first failed the board spec, which still counted
  five rules between columns. Kept `pipeline-board.png`, which shows the
  Drafted column. Integration: 19 passing, run again after 3.3.
- [x] 5.5 `openspec validate a-change-before-its-proposal --strict`, and
  the merge gate locally with `--base origin/main`. Validate: valid; the
  gate exit 0.
- [x] 5.6 A changeset: core, webui, the server and the extension, minor.

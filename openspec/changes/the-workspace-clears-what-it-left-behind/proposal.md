## Why

The owner opened the workspace on 2026-09-18 and the product listed two
changes that do not exist:

```
the-summary-reads-the-workspace-once   No tasks
a-screen-says-what-it-is-doing         No tasks
```

Both had been archived days earlier. What was left under
`openspec/changes/<name>/` was a single `harness.json` holding `{}` — the
file the per-change harness settings panel writes when it is opened and
saved with nothing set. `openspec archive` moves the change's documents and
leaves anything it does not know about, and
`discoverOpenSpecWorkspace` treats every directory under
`openspec/changes/` as a change (`workbench.ts`'s `directoryNames`), so a
directory holding one stray file is listed beside real work, with no tasks
and no state.

The same thing happens beside the repository. `C:\Prog\.worktrees\` held
three working directories on 2026-09-18; two were on branches whose pull
requests had merged days before, and nothing in the product said so. The
owner's words for it: a lot gets stuck there.

Neither is a defect in one screen. It is that nothing reads what the
product itself left behind, so the person is the sweeper.

## What Changes

- **Core learns what a leftover is.** A directory under
  `openspec/changes/` that carries none of a change's documents — no
  `proposal.md`, `design.md`, `tasks.md` and no `specs/` — is not a change.
  It is reported as a leftover, with what it does hold and whether a change
  of that name is already in the archive.
- **A leftover of an archived change is cleared by the product.** Where the
  archive holds a change of that name and the directory holds nothing but
  files the product writes, it is removed: at the start of a reading and
  again on a settled interval, in both hosts. Nothing else is removed
  without a person pressing for it.
- **Anything else left behind is shown, not removed.** A directory with no
  documents and no archived twin may be a change somebody is starting by
  hand, so the product says it found it, says why it looks empty, and
  offers to remove it.
- **Working directories beside the repository are surveyed for staleness.**
  A worktree whose branch is merged or gone, whose tree is clean and which
  carries no recorded run is reported as finished with, with the branch and
  the reason. Removing one stays a press: a working directory can hold
  uncommitted work, and its `node_modules` may be junctions into the
  primary tree, where a careless delete takes the primary tree's packages
  with it.
- **Both hosts show what was found.** The standalone shell says it in the
  Summary, the editor in its Changes view's own notice, with the same words
  from the same core reading.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-workbench`: what the workspace leaves behind is readable, and a
  leftover of an archived change is cleared.
- `standalone-app`: the Summary says what was left behind and offers to
  clear it.
- `vscode-extension`: the editor says the same, from the same reading.

## Impact

- **`packages/core`**: a new `src/workspace-leftovers.ts` reading leftover
  change directories and stale working directories, and removing a cleared
  one, with its test; `src/workbench.ts` stops counting a document-less
  directory as a change.
- **`packages/server`**: a route over the reading and one over the removal.
- **`packages/webui`**: the Summary's panel for what was left behind.
- **`packages/extension`**: the same notice in the Changes view, the
  sweep on activation and on its interval.
- **Unchanged**: `openspec archive` itself, the audit log, and every
  reading that lists real changes.

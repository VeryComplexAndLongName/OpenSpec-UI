## Why

On 2026-09-22 the workspace sweep in the editor could not remove a
finished working directory. The directory held a VS Code that the
integration suite had downloaded into `packages/extension/.vscode-test`.
The sweep reported only "Filename too long", and the directory stayed on
disk. The owner: everything must be removed, whatever the path length.

Two things went wrong, and git's message hid the second:

1. **git gave up on the long paths.** Git for Windows refuses a path
   longer than 260 characters unless `core.longpaths` is on. It forgot the
   worktree, and deleted part of the directory.
2. **Removing what git left failed too, and the editor did it.** In the
   editor, Node's `fs` is Electron's. It reads a file named `*.asar` as an
   archive, which it opens as a directory. The recursive removal met the
   downloaded editor's `node_modules.asar`, opened it and failed with
   `EBUSY`. The editor then held the file for as long as it ran, so nothing
   could remove it.

This was reproduced the same day in the editor's own Electron (42.10,
Node 24.18). `fs/promises.rm` failed with `EBUSY` on a directory holding a
copy of `node_modules.asar`, and the process then held the file. Electron's
unpatched `original-fs` removed the same tree cleanly.

## What Changes

- **`git worktree remove` runs with `-c core.longpaths=true`**, so git
  itself removes a directory with long paths. Other platforms ignore the
  setting.
- **A new `plain-fs.ts` module** is `original-fs` in Electron and Node's
  own `fs/promises` everywhere else. It provides `removeTree`, which
  retries a file held for a moment.
  - It is used by `removeDirectoryShell` (the sweep), by
    `workspace-leftovers.ts` (leftover changes, worktree shells, a removal
    somebody asked for), and by the archive pass's temporary directory.
- **A failed removal says what stopped it first**, and git's reason after
  it, instead of git's reason alone.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the sweep finishes a removal git gave up on, in the
  editor too.

## Impact

- `packages/core/src/plain-fs.ts` (new), `finished-directories.ts`,
  `workspace-leftovers.ts`, `workspace-sweep.ts`, `git.ts`, `index.ts`.
- Tests:
  - `finished-directories.test.ts`;
  - `finished-directories.removal.test.ts`: a real worktree with a
    480-character path;
  - a new integration test in `packages/extension/src/test/suite/removal.test.ts`,
    run inside VS Code on a copy of the editor's own `node_modules.asar`.
- A changeset: core, the server and the extension, patch.

## Explicitly out of scope

- **A directory an earlier failed removal left behind.** Git no longer
  lists it and it still holds files, so the shell sweep keeps it as
  somebody's, as it always has. This change keeps such a directory from
  arising in the first place. The one left on this machine on 2026-09-22
  is removed by hand.

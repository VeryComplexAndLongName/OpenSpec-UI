Asked by the owner on 2026-09-22: everything must be removed, whatever
"Filename too long" says.

## 1. The cause

- [x] 1.1 Reproduced in the editor's own Electron (VS Code's `Code.exe`
  with `ELECTRON_RUN_AS_NODE`, Electron 42.10.0, Node 24.18.1):
  - `fs/promises.rm` on a directory holding a copy of
    `node_modules.asar` failed with `EBUSY: resource busy or locked,
    rmdir '...node_modules.asar'`;
  - the process then held the file, and even `original-fs` could not
    remove it;
  - `original-fs` removed a fresh copy of the same tree cleanly.
- [x] 1.2 Reproduced git's half with Git for Windows 2.54.0 on a worktree
  holding a 480-character path:
  - `git worktree remove --force` failed with "Filename too long" and
    forgot the worktree;
  - with `-c core.longpaths=true` it removed it.

## 2. The fix

- [x] 2.1 `git.ts`: `worktreeRemove` runs with `-c core.longpaths=true`.
- [x] 2.2 `plain-fs.ts`: `original-fs` in Electron, Node's `fs/promises`
  elsewhere, and `removeTree`, which retries a file held for a moment.
- [x] 2.3 `finished-directories.ts`, `workspace-leftovers.ts` and the
  archive pass's temporary directory in `workspace-sweep.ts` remove and
  walk through it.
- [x] 2.4 A removal that fails both ways says the removal's own reason
  first, and git's after it.

## 3. Checks

- [x] 3.1 Tests:
  - the failure message;
  - a real worktree with a 480-character path, removed by git alone;
  - an integration test inside VS Code: a directory holding a copy of the
    editor's own `node_modules.asar` is removed.

  With `original-fs` turned off, the integration test fails (the removal
  did not finish within 120 s); with it, 19 passing.
- [x] 3.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped:
  - typecheck and lint: exit 0;
  - passed: cli 175, extension 492, server 114, webui 651, and core 1796
    of 1797.
  
  The one that failed was `stop-boundary.test.ts`, a `vi.waitFor` timeout
  under load, which kept the chain from reaching `core-git-subprocess`. Run
  separately afterwards: `stop-boundary.test.ts` 13 of 13, and
  `core-git-subprocess` 46 of 46.
- [x] 3.3 The whole standalone browser suite: 28 of 28.
- [x] 3.4 The extension's integration suite: 19 passing.
- [x] 3.5 A changeset: core, the server and the extension, patch.
- [x] 3.6 `openspec validate the-sweep-never-opens-an-archive --strict`:
  valid.
- [ ] 3.7 The directory the failed removal left on 2026-09-22,
  `C:\Prog\.worktrees\OpenSpec-UI\the-product-merges-what-it-archives`, is
  removed. The owner's editor holds its `node_modules.asar` until its
  extension host restarts.

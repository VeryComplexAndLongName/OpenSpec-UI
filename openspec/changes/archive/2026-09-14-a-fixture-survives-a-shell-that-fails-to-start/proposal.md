# A fixture survives a shell that fails to start

## Why

`packages/core/src/git-refs.test.ts` failed during a full `npm run verify`
five times on 2026-09-14. It passed alone every time, and CI on Linux never
failed it.

Each failure came in the fixture's `git push`:

```text
C:\Tools\Git\usr\bin\sh.exe: *** fatal error - add_item ("\??\C:\Tools\Git", "/", ...) failed, errno 1
```

`GIT_TRACE` shows the cause. Git for Windows runs the far end of a push,
fetch or clone against a local path through its MSYS shell:
`sh.exe -c 'git-receive-pack …'`, or `git-upload-pack`. Under a whole
suite's parallel load, that shell sometimes dies while it starts.

Two kinds of test start that shell:

- **A fixture that pushes.** `git-refs.test.ts` pushed twice in each of its
  three tests, six shells. None of them was the code under test.
- **The code under test.** `git.push.test.ts` tests `wrapper.push`, and
  `git-refs.test.ts` tests `wrapper.fetch`. Each starts one shell, and each
  needs that shell to succeed.

  `core-test-worker-contention` gave `git.push.test.ts` a single fork of its
  own. But its project runs at the same time as the parallel `core`
  project. With the fixture fixed, `git-refs.test.ts` passed inside a full
  verify, and `git.push.test.ts` died there instead, of the same fatal.

Each such failure left the verify task it hit open until CI ran. The rule
in `quality-gates` is that a check fails only for a reason in what it
checks. That rule was not being kept.

## What Changes

- **The `git-refs` fixture builds its remote without a push.**
  - The bare remote borrows the work repository's objects through
    `objects/info/alternates`.
  - Its branches, and the work repository's `refs/remotes/origin/*`, are
    written with `git update-ref`, which starts no shell.
- **Tests that need such a shell run apart.**
  - `packages/core/vitest.workspace.ts` lists them once, as
    `SHELL_STARTING_TESTS`: `git.push.test.ts` and `git-refs.test.ts`.
  - They form the `core-git-subprocess` project, and the parallel `core`
    project excludes them.
  - Core's `test` script runs `core` first, then `core-git-subprocess`, one
    after the other.
  - A trace of the whole package found three shell starts. The third is
    `change-standing.test.ts`'s fetch from a remote that does not exist. It
    expects that fetch to fail, so it stays in the parallel project.

## Capabilities

### Modified

- `quality-gates`:
  - a fixture builds what it needs without starting a process that the
    code under test does not start;
  - a test whose code under test needs such a process to start runs apart
    from the parallel load.

## Impact

- `packages/core/src/git-refs.test.ts`.
- `packages/core/vitest.workspace.ts`, and the `test` script in
  `packages/core/package.json`.
- No product code changes, so there is no changeset.

## Out of scope

- **Retrying a git command that failed.** A retry would also hide a real
  failure of the wrapper's push or fetch.
- **Whether a product push or fetch should survive a shell that dies while
  it starts.** That is behaviour of the git stage, not of the tests.

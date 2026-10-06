## Why

On 2026-10-06 the dependency audit failed every pull request: two
critical advisories in `simple-git` <= 4.0.1 (GHSA-v5rq-49vh-5v5c, the
`VISUAL` editor variable missing from its unsafe-editor detection, and
GHSA-x6jw-m9v5-85vh, trailer command configuration not blocked). The fix
is only in 4.0.2; this repository was on 3.x.

simple-git 4 also changes what the `git` it starts can see: every
`GIT_`-prefixed variable and a few others (`EDITOR`, `PAGER`,
`SSH_ASKPASS`, `VISUAL`, `PREFIX`) are removed from its environment. That
includes what a person set up to reach a remote - the askpass helper VS
Code provides, an SSH command - and without them a push either fails to
authenticate or, as measured here with an SSH remote, waits until it is
killed.

## What Changes

- `simple-git` ^4.0.2 in `core` and `cli`; the default import, which 4
  removed, is replaced.
- Every `git` this product starts through simple-git is opened by one
  function, `openGit(cwd)`, which lets through only the variables that
  carry how to connect and authenticate: `GIT_ASKPASS`, `SSH_ASKPASS`,
  `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_TERMINAL_PROMPT`.
  Every other guarded variable stays removed.
- Test fixtures that commit with a set author and date name those
  variables, which simple-git 4 otherwise refuses.

## Capabilities

### Modified Capabilities

- `execution-core`: the git this product starts keeps the person's
  connection settings and nothing else of the guarded environment.

## Impact

- `packages/core`: `git-client.ts` (new), every module that opened
  simple-git, `test-support/git-isolation.ts`.
- `packages/core`, `packages/cli`: `package.json`; `package-lock.json`.

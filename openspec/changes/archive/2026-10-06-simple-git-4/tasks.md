The dependency audit failed every pull request on 2026-10-06: two
critical advisories in simple-git <= 4.0.1, fixed only in 4.0.2.

## 1. Dependency

- [x] 1.1 `simple-git` ^4.0.2 in `packages/core` and `packages/cli`;
  `npm audit --omit=dev --audit-level=high` reports nothing.
  simple-git 4.0.2 in both; `npm audit --omit=dev --audit-level=high`:
  found 0 vulnerabilities.
- [x] 1.2 `git-client.ts`: `openGit(cwd)` (design.md decisions 1, 2); every
  `simpleGit(...)` outside tests replaced; the default import, which 4
  removed, replaced in tests. Test in `git-client.test.ts`, in the
  single-fork project: a `GIT_SSH_COMMAND` reaches git, a `GIT_EDITOR` does
  not; checked to fail without the allowance.
  `git-client.test.ts`: 2 passed; with `allowEnvironment: []` the SSH
  case failed, git waiting on the real ssh until the 45 s budget.
- [x] 1.3 `test-support/git-isolation.ts`: fixture commits name the author
  and committer variables (decision 3); `git.test.ts` asserts the options
  `openGit` passes.
  `git.test.ts` 5 passed; every fixture file passes in the full run.

## 2. Documents

- [x] 2.1 A changeset: core, cli, server, extension, patch.
  `.changeset/simple-git-4.md`.

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
  Typecheck clean; lint 0 errors (3 warnings in lines this change did
  not touch); seven script tests pass. Core 2096, core-git-subprocess 69,
  cli 201, webui 712, server 122, extension 502 passed.
- [x] 3.2 `openspec validate simple-git-4 --strict`, and the merge gate
  with the worktree's absolute path as `--cwd`.
  Valid; the gate with the worktree's absolute path reports ok.
- [x] 3.3 A real push through the product's git wrapper to a remote that
  needs the person's credentials, recorded.
  Record, 2026-10-06: this branch pushed to GitHub over HTTPS by
  `createGitWrapper(...).push("origin", "simple-git-4")` from a script, in
  4.1 s, authenticated by the Git Credential Manager named in git's
  configuration; `ls-remote` then showed the branch at the local HEAD. The
  askpass and SSH routes, which this machine does not use for this
  remote, are the ones `git-client.test.ts` checks.

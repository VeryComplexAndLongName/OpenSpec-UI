The dependency audit failed every pull request on 2026-10-06: two
critical advisories in simple-git <= 4.0.1, fixed only in 4.0.2.

## 1. Dependency

- [ ] 1.1 `simple-git` ^4.0.2 in `packages/core` and `packages/cli`;
  `npm audit --omit=dev --audit-level=high` reports nothing.
- [ ] 1.2 `git-client.ts`: `openGit(cwd)` (design.md decisions 1, 2); every
  `simpleGit(...)` outside tests replaced; the default import, which 4
  removed, replaced in tests. Test in `git-client.test.ts`, in the
  single-fork project: a `GIT_SSH_COMMAND` reaches git, a `GIT_EDITOR` does
  not; checked to fail without the allowance.
- [ ] 1.3 `test-support/git-isolation.ts`: fixture commits name the author
  and committer variables (decision 3); `git.test.ts` asserts the options
  `openGit` passes.

## 2. Documents

- [ ] 2.1 A changeset: core, cli, server, extension, patch.

## 3. Checks

- [ ] 3.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
- [ ] 3.2 `openspec validate simple-git-4 --strict`, and the merge gate
  with the worktree's absolute path as `--cwd`.
- [ ] 3.3 A real push through the product's git wrapper to a remote that
  needs the person's credentials, recorded.

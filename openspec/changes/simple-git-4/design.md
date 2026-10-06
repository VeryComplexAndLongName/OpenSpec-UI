## Context

simple-git 4 (`allowEnvironment`, `@simple-git/argv-parser`'s
`isGitEnvKey`) strips, from the environment of every git it runs, each key
starting with `GIT_` and `editor`, `pager`, `prefix`, `ssh_askpass`,
`visual`. A key passed through `.env()` that is guarded and not allowed
rejects the task. Of the allowed ones, those that run a program
(`GIT_ASKPASS`, `SSH_ASKPASS`, `GIT_SSH`, `GIT_SSH_COMMAND`) also need the
matching `unsafe` flag, or the task is refused.

This product runs git through simple-git for status, diff, log, blame,
commit, push, fetch, pull and rebase, in the extension host, the server
and the CLI, and never passes an environment of its own.

## Decisions

1. **One function opens git.** `openGit(cwd)` in `git-client.ts` replaces
   every `simpleGit(cwd)` outside tests, so what reaches git is decided in
   one place.
2. **The connection variables pass, the rest do not.** `GIT_ASKPASS`,
   `SSH_ASKPASS`, `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT` and
   `GIT_TERMINAL_PROMPT`, with `allowUnsafeAskPass` and
   `allowUnsafeSshCommand`. They come from the person's own environment
   (their shell, VS Code); nothing here builds them from a change, a task
   or an agent's output, which is what the advisories are about. Editors,
   pagers, config paths, `GIT_DIR` and the like stay removed: nothing here
   opens an editor or a pager, and a stray `GIT_DIR` in a parent's
   environment is a way to act on the wrong repository.
   - *Alternative: allow every `GIT_` variable.* Rejected: it gives back
     what 4 took away for a reason, for no case this product has.
   - *Alternative: allow none.* Rejected: measured in `git-client.test.ts`,
     an SSH remote then waits on the real `ssh` until it is killed.
3. **Fixtures name what they set.** `gitIsolationOptions()` adds the six
   author and committer variables fixture commits pass through `.env()`.

## Risks / Trade-offs

- **A setup that relied on another stripped variable** (a proxy command,
  `GIT_CONFIG_GLOBAL`) no longer reaches git. Proxy settings in the
  environment (`HTTPS_PROXY`) and in git's own configuration are not
  guarded and still apply.

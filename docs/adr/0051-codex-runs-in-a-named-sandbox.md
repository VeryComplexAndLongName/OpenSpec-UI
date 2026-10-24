# 0051: Codex Runs in a Named Sandbox, by What Its Stage Does

Status: Accepted

Date: 2026-10-24

## Context

`codex-cli` ran `codex exec --skip-git-repo-check` and fed it the prompt.
It named no sandbox and no approval policy, deliberately: the allowlist
admitted only one `-c` key, the reasoning effort. A trial on 2026-10-24,
`codex` 0.164.0 with the owner's `~/.codex/config.toml`, showed what that
meant:

- **Told nothing, `codex exec` ran read-only.** Asked to write one file, the
  agent replied "this workspace is read-only", wrote nothing, and the
  process exited 0. An apply stage on `codex-cli` changed nothing and was
  read as done.
- **With `--sandbox workspace-write`** it wrote the file in its working
  directory, was refused a file in `C:\Prog` ("denied by the filesystem
  sandbox"), and wrote one in the system's temporary directory, which
  Codex's `workspace-write` admits by default.

The product's own `cwd` sandbox (`checkCwdSandbox`) decides where a run may
start; it does not confine what a child agent writes once started. For
Codex, that is Codex's own sandbox.

## Decision

1. **The sandbox is always named, by what the stage does.** `plan`,
   `implement`, `update` and `verify` write the change - its artifacts, its
   code, its ticks, the caches its checks write - and run in
   `workspace-write`. `review` and every query run in `read-only`.
2. **Never full access.** `danger-full-access` and
   `--dangerously-bypass-approvals-and-sandbox` are never named, and the
   allowlist refuses any invocation that names them, or names no sandbox.
3. **The approval policy is left to `codex exec`**, which asks no one in
   non-interactive mode; the sandbox is what bounds it.
4. **The event stream is read** (`--json`): messages, commands and their
   exit codes, changed files, the turn's usage, a failed turn - where plain
   text gave only prose, no usage, and exit 0 for a failed turn.

## Consequences

- An apply stage on `codex-cli` writes the change, and nothing outside its
  worktree but the temporary directory.
- A run on `codex-cli` reports tokens, so a token ceiling can act on it.
- A person who wants Codex to run with more access configures that outside
  this product; the product does not offer it.

## Alternatives considered

- **Leave the sandbox to the person's Codex configuration.** Rejected: the
  default the trial met writes nothing and reports success, and a
  configuration elsewhere cannot be read from a harness file.
- **`workspace-write` for every command.** Rejected: a review has no
  business writing, and read-only says so to the agent.

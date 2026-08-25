# Live smoke-test notes — standalone-app

Date: 2026-08-03. Performed as part of tasks.md 3.1/3.2.

## Environment

- `claude` CLI: `C:\Users\ivanov.a\.local\bin\claude.exe` — installed, but
  **not authorized** in this environment (`Not logged in · Please run /login`).
  This is a separate installation, unrelated to the session in which the
  development work itself is being done.
- `copilot` CLI: `C:\Users\ivanov.a\AppData\Roaming\npm\copilot` (an npm
  shim that actually resolves to `copilot.cmd` on Windows) — authorized
  and working.
- `codex`, `gemini` — not installed in this environment. Their adapters
  are validated only by mocks/contract tests (see `execution-core`
  tasks.md 2.7/2.8) — a real live run for them is not available at this
  phase of development.

## Test procedure

1. Started `packages/server` (`npm run start`) with `workspaceRoot`
   pointing at a disposable scratch directory (not at the real
   repository — see below, "Why not against the real repository").
2. Opened the browser shell (`packages/server/public/index.html` +
   the built `dist/app.js`) via a real HTTP request in the browser.
3. In the AI panel, set `cwd`/`changeDir` to the scratch directory,
   selected an agent, and ran the `plan` command.

### Attempt 1 — `claude-cli`

Result: `started` → `stdout` (`Not logged in · Please run /login`) →
`failed: claude exited with code 1`. Expected — the real CLI is not
authorized in this environment. Confirms that spawning the process,
passing arguments, and capturing stdout/exit code work correctly (the
error is environmental, not a code issue).

### Attempt 2 — `copilot-cli`, before fixes

Result: `failed: spawn copilot ENOENT`.

**Bug found**: `agents/shared.ts`'s `spawnAndStream` used plain
`node:child_process.spawn(executable, args)` without `shell: true`. On
Windows, `copilot` resolves to a `.cmd` shim (`copilot.cmd`), not a
`.exe` — Node cannot launch a `.cmd` directly without an interpreter.
Enabling `shell: true` directly would be unsafe: `copilot`'s prompt (which
can contain arbitrary change-file content) is passed in precisely as an
argv argument, and plain `shell: true` would open a shell injection
through that argument.

**Fix**: `agents/shared.ts` was switched to `cross-spawn` — it correctly
resolves `.cmd`/`.bat` on Windows, escaping each argument individually
rather than interpreting the resulting command line in a shell. See
`packages/core/src/agents/shared.ts`, `@openspec-ui/core@0.4.1`.

### Attempt 3 — `copilot-cli`, after the spawn fix

Result: `started` → `stdout` (`No task was specified in your message —
"--allow-all-tools" is a flag, not a request...`) → `completed`.

**Bug found**: `CopilotCliAdapter` passed the prompt via stdin (like
Claude/Codex/Gemini), but `copilot -p` does not read stdin — the prompt
must be a positional argument right after `-p`.

**Fix**: `CopilotCliAdapter.execute()` now embeds the prompt into argv
(`["-p", prompt, "--allow-all-tools"]`) only after `buildInvocation()`'s
static shape (`["-p", "--allow-all-tools"]`) has passed the allowlist
check — the prompt's content still does not affect whether the run itself
is permitted (see `packages/core/src/agents/copilot.ts`).

### Attempt 4 — `copilot-cli`, after both fixes

Result: `started (plan)` → `stdout` (a real Copilot response: it correctly
noticed that the change's description was empty and asked for the task to
be clarified) → `completed`. AI Credits were actually spent (9.05, ~10s),
tokens — see Copilot's own usage line in the output. **The full pipeline
was confirmed end-to-end**: browser → WebSocket → `server` →
`execution-core`'s `AgentRunner` → the real CLI agent process → event
stream → rendering in the browser.

## Why not against the real repository

`plan`/`implement`/`review` are real CLI-agent invocations with tool
access (`--allow-all-tools` for copilot, similarly for claude). Running
them with `cwd` pointing at `C:\Prog\OpenSpec-UI` would mean entrusting
the real repository to an unverified agent run as part of a smoke test.
Instead, `workspaceRoot`/`cwd` pointed at a disposable scratch directory
with a fake `openspec/changes/demo/proposal.md` — this isolation removes
the risk entirely without sacrificing anything in verifying the pipeline
itself.

## Conclusion

- `claude-cli` and `copilot-cli` are the only agents available for live
  testing at this phase of development (see also `execution-core`
  tasks.md 2.8). `copilot-cli` was confirmed fully working end-to-end.
  `claude-cli` was confirmed mechanically working (spawn/argv/stdout/exit
  code), but was not tested end-to-end due to the lack of authorization
  in this environment — this is an environment limitation, not a blocker
  for archiving.
- `codex-cli`/`gemini-cli` remain validated only by mocks/contract
  tests — the CLIs are not installed in this environment.
- Both bugs found (spawning a `.cmd` on Windows, copilot's argv-vs-stdin)
  were fixed in `@openspec-ui/core` and are covered by unit tests
  (`agents/shared.test.ts`, `agents/copilot.test.ts`).

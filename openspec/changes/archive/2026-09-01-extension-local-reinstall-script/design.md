## Context

See `proposal.md`. `packages/extension/package.json` already has a
`"package"` script (`npm run build && vsce package --no-dependencies`) that
produces `openspec-ui-vscode-<version>.vsix` in `packages/extension/`. What
is missing is the last mile: locating that exact file and force-installing
it into the local VS Code, which was done by hand twice this session with
`code --install-extension "<absolute path>" --force` — `--force` is
required because `code --install-extension` is a silent no-op when the
target version is already installed, which is the common case for local
iteration (per `internal-version-cascade`, the version only changes on a
real changeset applied at merge time, not on every local rebuild).

## Goals / Non-Goals

**Goals:**

- One command, run from `packages/extension`, that always leaves the
  locally installed extension matching whatever is currently in the
  working tree — no separate "what version is this .vsix again" or
  "did I remember `--force`" steps.
- Fail loudly and clearly if `vsce`/`code` are unavailable or the build
  step itself fails, rather than silently doing nothing (the exact failure
  mode `--force`'s absence causes today).

**Non-Goals (this change):**

- Automating the final "Developer: Reload Window" step. VS Code has no
  documented CLI flag or command to reload a specific already-open window
  from outside that window (`code`'s CLI only opens/manages windows and
  installs/uninstalls extensions; there is no `--reload` equivalent), and
  the other agent working concurrently in this same VS Code instance means
  an automated reload could interrupt an unrelated in-progress operation
  in that window without warning — reload must stay an explicit, human
  -timed action. The script prints a reminder instead.
- Changing anything about the real release pipeline (`release-extension`
  CI job, Marketplace publishing) — this script only ever targets a local
  developer's own VS Code installation.
- Adding this as a `preLaunchTask` for the "Extension: Development Host"
  (F5) launch config in `.vscode/launch.json` — F5 does not install a
  packaged `.vsix` at all (it loads `dist/` directly via
  `--extensionDevelopmentPath`), so it does not have this problem in the
  first place; wiring a `npm run build` prelaunch step there (its
  `preLaunchTask` currently only runs typecheck) is a separate, narrower
  fix for a different gap, out of scope here.

## Decisions

### A plain Node script (`scripts/reinstall-local.mjs`), not a shell one-liner in `package.json`

Chosen: a small `.mjs` script using `child_process.execFileSync`, run via
a `"reinstall:local"` npm script. It needs to read the just-built version
out of `package.json` to construct the exact `.vsix` filename
(`openspec-ui-vscode-<version>.vsix`) before installing it — a plain
inline shell command in `package.json` (as `"package"` already is) cannot
do that string interpolation portably across `cmd.exe`/POSIX shells,
which matters here since this repository's primary development machine is
Windows (see `CLAUDE.md`'s runtime-environment note and this session's own
CP866/`cmd.exe`-quoting lessons from `copilot-prompt-length-limit`).

**Rejected alternative**: glob for `openspec-ui-vscode-*.vsix` and install
the newest by mtime instead of reading the exact version. Rejected — stale
`.vsix` files from old versions already accumulate in
`packages/extension/` (five were found there from `0.21.0` through
`0.24.1` before this session), so "newest by mtime" is one accidental
`touch`/checkout away from silently installing the wrong file; reading the
authoritative version straight from `package.json` (the same source
`vsce package` itself uses to name the file) has no such ambiguity.

### Always `--force`, unconditionally

Chosen: the script always passes `--force` to `code --install-extension`.
There is no case where a developer runs this script and *doesn't* want the
freshly built local artifact installed — that is the script's entire
purpose.

**Rejected alternative**: detect whether the version actually changed and
only pass `--force` when it did not (mirroring `code`'s own default
no-op-on-same-version behavior otherwise). Rejected — pure added
complexity for zero behavioral difference a caller of this specific script
would ever observe or want.

## Risks / Trade-offs

- **[Trade-off]** Still requires a manual "Developer: Reload Window" —
  see Non-Goals above for why that is deliberately not automated here.
  Accepted; the script's printed reminder is the mitigation.
- **[Risk]** None identified for CI/release: this script is never invoked
  by any CI job (`quality.yml` has no reference to it, and none is added),
  purely a local convenience command.

## Migration Plan

No migration. Existing stale `.vsix` files in `packages/extension/` (the
`0.21.0`-`0.24.1` ones already on disk) are left as-is — this change does
not clean them up, since they are already `.gitignore`d build artifacts,
not tracked state.

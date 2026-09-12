Everything that stops a run is already decided in one place, and can
only be asked by starting a run and being refused.

## 1. The report

- [ ] 1.1 `packages/core/src/environment-report.ts` exports
  `Finding` (`{ id, severity, statement, remedy? }`, `severity` one of
  `"stops-a-run" | "worth-knowing"`) and
  `readEnvironmentReport({ workspaceRoot }): Promise<EnvironmentReport>`.
- [ ] 1.2 The runtime: the running Node.js and npm versions against the
  root `package.json`'s `engines`. Outside the range is `stops-a-run`,
  with the pinned range quoted in the statement.
- [ ] 1.3 The `openspec` CLI: resolved on the PATH or not. Absent is
  `stops-a-run` — `validate-change` and the `archive` stage both call
  it.
- [ ] 1.4 Each agent in `AGENT_REGISTRY`: present or absent, from
  `detectAvailableAgentsDetailed` in
  `packages/core/src/agent-detection.ts`, including the version it
  reports where it has one. Do not probe a second way: the picker, the
  REST route and the VS Code bridge all read that function, and a
  command answering "is this agent here" differently from the picker in
  the same build is the drift this change objects to elsewhere.
- [ ] 1.5 The workspace's harness configuration: `resolveHarnessConfig`
  on the global file reads, or the error it raised, as `stops-a-run`.
- [ ] 1.6 The workspace lease, via `readWorkspaceLeaseHolder`: who holds
  it, or that it is free. Held is `worth-knowing`, never `stops-a-run`
  — a busy workspace is not a broken one.
- [ ] 1.7 The git identity, via `readGitAuthor`: present or not. Absent
  is `worth-knowing`, with the remedy naming `git config user.email`. A
  lease taken without one is valid.
- [ ] 1.8 No environment variable's value is read or reported. A finding
  may name a variable; it may not print what it contains.
- [ ] 1.9 `packages/core/src/environment-report.test.ts`: a report over
  a fixture with everything present has no `stops-a-run` finding; a
  missing `openspec` produces one; an out-of-range Node version produces
  one quoting the range; a held lease produces a `worth-knowing`
  finding; every executable in `AGENT_REGISTRY` appears in the report —
  the assertion that fails when an agent is added and this is not
  updated.

## 2. The command

- [ ] 2.1 `openspec-ui-cli doctor [--cwd <path>] [--change <id>]
  [--format text|json]` in `packages/cli/src/doctor-command.ts`, wired
  in `packages/cli/src/main.ts` with its own `USAGE` entry and its exit
  codes documented there.
- [ ] 2.2 `--change <id>` additionally calls `resolveChainStart` with the
  same resolver `runChange` builds, and prints its refusal's `reason`
  and `configKey`. Do not re-derive any precondition it answers.
- [ ] 2.3 Exit `0` where no finding stops a run, `1` where one does, `2`
  where the report could not be produced. A held workspace alone exits
  `0`.
- [ ] 2.4 `--format json` prints the `EnvironmentReport` shape unchanged
  from core.
- [ ] 2.5 `packages/cli/src/doctor-command.test.ts`: a clean report exits
  0; a `stops-a-run` finding exits 1 and names the remedy; a held
  workspace alone exits 0; `--change` on a change whose configuration
  refuses prints the preflight's own reason and `configKey` and exits 1;
  an unreadable workspace exits 2.

## 3. Documentation

- [ ] 3.1 `README.md`'s "CI CLI (merge gate)" section documents `doctor`
  and its three exit codes.
- [ ] 3.2 `HARNESS.md`'s task index gains a row: "Find out what would
  stop a run here" → `openspec-ui-cli doctor`.

## 4. Verification

- [ ] 4.1 This change validates strictly. `check(validate-change)`
- [ ] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 4.3 A changeset exists: `core` and `cli` minor.
  `check(changeset-present)`
- [ ] 4.4 **Delegated to `claude-cli`**: run `openspec-ui-cli doctor` on
  this repository and quote the output and exit code; then run it with
  `PATH` stripped of `openspec` and quote the output and exit code.
  Evidence: both outputs verbatim, showing the same command reporting a
  healthy machine and a broken one.
- [ ] 4.5 **Delegated to `claude-cli`**: while a run holds the
  workspace, run `openspec-ui-cli doctor` and quote the lease finding
  and the exit code, which must be `0`. Evidence: the output and the
  exit code.

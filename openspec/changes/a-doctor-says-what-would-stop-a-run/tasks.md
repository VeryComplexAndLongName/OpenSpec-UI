Everything that stops a run is already decided in one place, and can
only be asked by starting a run and being refused.

## 1. The report

- [x] 1.1 `packages/core/src/environment-report.ts` exports
  `Finding` (`{ id, severity, statement, remedy? }`, `severity` one of
  `"stops-a-run" | "worth-knowing"`) and
  `readEnvironmentReport({ workspaceRoot }): Promise<EnvironmentReport>`.
  Plus `stopsARun(report)`, so the one question the exit code is derived
  from is answered in core rather than by each caller filtering
  severities its own way.
- [x] 1.2 The runtime: the running Node.js and npm versions against the
  root `package.json`'s `engines`. Outside the range is `stops-a-run`,
  with the pinned range quoted in the statement.
  Range reading is `satisfiesMajorRange`, deliberately tiny: it reads the
  `>=X` / `<Y` / `^X` clause forms this repository pins, on the major
  version, and answers `undefined` for anything else — reported as
  `worth-knowing` ("this check cannot read that range") rather than
  guessed. A partial comparator that treated what it could not parse as
  satisfied is how a check stops checking.
- [x] 1.3 The `openspec` CLI: resolved on the PATH or not. Absent is
  `stops-a-run` — `validate-change` and the `archive` stage both call
  it.
- [x] 1.4 Each agent in `AGENT_REGISTRY`: present or absent, from
  `detectAvailableAgentsDetailed` in
  `packages/core/src/agent-detection.ts`, including the version it
  reports where it has one. Do not probe a second way: the picker, the
  REST route and the VS Code bridge all read that function, and a
  command answering "is this agent here" differently from the picker in
  the same build is the drift this change objects to elsewhere.
  `openspec` and `npm` are not agents and are not in that map, so
  `detectCliAgent` is exported from the same module as
  `detectExecutable` and used for them — the same probe, not a second
  one written beside it.
- [x] 1.5 The workspace's harness configuration: `resolveHarnessConfig`
  on the global file reads, or the error it raised, as `stops-a-run`.
- [x] 1.6 The workspace lease, via `readWorkspaceLeaseHolder`: who holds
  it, or that it is free. Held is `worth-knowing`, never `stops-a-run`
  — a busy workspace is not a broken one.
- [x] 1.7 The git identity, via `readGitAuthor`: present or not. Absent
  is `worth-knowing`, with the remedy naming `git config user.email`. A
  lease taken without one is valid.
- [x] 1.8 No environment variable's value is read or reported. A finding
  may name a variable; it may not print what it contains.
  Nothing in this module reads `process.env` at all; the only runtime
  fact it takes is `process.version`.
- [x] 1.9 `packages/core/src/environment-report.test.ts`: a report over
  a fixture with everything present has no `stops-a-run` finding; a
  missing `openspec` produces one; an out-of-range Node version produces
  one quoting the range; a held lease produces a `worth-knowing`
  finding; every executable in `AGENT_REGISTRY` appears in the report —
  the assertion that fails when an agent is added and this is not
  updated.
  Ten tests, all passing, including two on `satisfiesMajorRange` — one
  of them asserting that a range it cannot read is `undefined` rather
  than "satisfied".

## 2. The command

- [x] 2.1 `openspec-ui-cli doctor [--cwd <path>] [--change <id>]
  [--format text|json]` in `packages/cli/src/doctor-command.ts`, wired
  in `packages/cli/src/main.ts` with its own `USAGE` entry and its exit
  codes documented there.
- [x] 2.2 `--change <id>` additionally calls `resolveChainStart` with the
  same resolver `runChange` builds, and prints its refusal's `reason`
  and `configKey`. Do not re-derive any precondition it answers.
  `canAnswerCheckpoints` comes from the same `deps.checkpoint.ask` the
  run derives it from, passed in by `main.ts` rather than read off
  `process.stdin` a second time.
- [x] 2.3 Exit `0` where no finding stops a run, `1` where one does, `2`
  where the report could not be produced. A held workspace alone exits
  `0`.
- [x] 2.4 `--format json` prints the `EnvironmentReport` shape unchanged
  from core.
- [x] 2.5 `packages/cli/src/doctor-command.test.ts`: a clean report exits
  0; a `stops-a-run` finding exits 1 and names the remedy; a held
  workspace alone exits 0; `--change` on a change whose configuration
  refuses prints the preflight's own reason and `configKey` and exits 1;
  an unreadable workspace exits 2.
  Seven tests, all passing — the five above plus a change that would
  start (exit 0) and the json shape.

## 3. Documentation

- [x] 3.1 `README.md`'s "CI CLI (merge gate)" section documents `doctor`
  and its three exit codes.
- [x] 3.2 `HARNESS.md`'s task index gains a row: "Find out what would
  stop a run here" → `openspec-ui-cli doctor`.

## 4. Verification

- [x] 4.1 This change validates strictly. `check(validate-change)`
  `openspec validate --strict --changes` — 6 passed, 0 failed, this
  change among them.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-12, exit 0 on the third attempt — the first two are the point
  of running it after the last edit rather than before. The first failed
  `typecheck`: the CLI test's stand-in for a successful
  `resolveChainStart` returned `config: {}`, which is not a
  `HarnessConfig`. The second failed `lint:test-budgets`: a test file
  that writes into a temporary directory must state a time budget, so
  the file now carries `vi.setConfig({ testTimeout: 15_000 })` with the
  measurement (38ms for the whole file) beside it.
  Tests on the passing run: cli 114 across 11 files, core 1102 across
  78, vscode 327 across 24, server 83 across 4, webui 389 across 42 —
  2015 across 159 files, 0 failed.
- [x] 4.3 A changeset exists: `core` and `cli` minor.
  `check(changeset-present)`
  `.changeset/a-doctor-says-what-would-stop-a-run.md`.
- [x] 4.4 **Delegated to `claude-cli`**: run `openspec-ui-cli doctor` on
  this repository and quote the output and exit code; then run it with
  `PATH` stripped of `openspec` and quote the output and exit code.
  Evidence: both outputs verbatim, showing the same command reporting a
  healthy machine and a broken one.
  2026-09-12, on this repository, exit 0:

  ```
  Nothing here would stop a run.
  Worth knowing:
    Not installed here: codex-cli, gemini-cli, local-llm, gemini-cli-acp,
    codex-cli-acp. A stage configured to use one of them will refuse to
    start.
  ```

  The same command with `PATH` cut back to Node and the system
  directories, exit 1 — which also exposed a different Node and npm than
  the pinned ones, so three findings rather than the one that was being
  provoked:

  ```
  4 things would stop a run:
    Running node is v24.18.0; this workspace pins >=22 <23.
      Use the runtime pinned in package.json (volta + engines), not an
      arbitrary global one.
    The `openspec` CLI is not on this PATH.
      Install it: npm install -g @openspec/cli
    Running npm is 12.0.1; this workspace pins >=10 <11.
      Use the runtime pinned in package.json (volta + engines), not an
      arbitrary global one.
    No agent this build carries is installed, so no stage that needs one
    can run.
      Install at least one of: claude-cli, copilot-cli, codex-cli,
      gemini-cli, local-llm, copilot-cli-acp, gemini-cli-acp,
      codex-cli-acp, claude-cli-acp
  Worth knowing:
    No git identity is configured here, so a lease taken from this
    directory records none.
      git config user.email you@example.com
  ```

  And `doctor --change two-steps-to-a-run` on this repository, exit 1,
  quoting the preflight's own refusal rather than a second opinion:
  `"two-steps-to-a-run" would not start here: this change's
  autonomyLevel is "assisted", ...` / `the setting that governs this is
  autonomyLevel`.
- [x] 4.5 **Delegated to `claude-cli`**: while a run holds the
  workspace, run `openspec-ui-cli doctor` and quote the lease finding
  and the exit code, which must be `0`. Evidence: the output and the
  exit code.
  2026-09-12. A real `openspec-ui-cli run` held a scratch workspace
  while this was asked of it. Exit **0**, with the holder under "Worth
  knowing":

  ```
  terminal run on HPP-NTB63, pid 10948, git author
  verycomplexandlongname@gmail.com holds this workspace (last reported
  itself 4s ago).
    Wait for it, or stop that process. `openspec-ui-cli lease`
    describes it.
  ```

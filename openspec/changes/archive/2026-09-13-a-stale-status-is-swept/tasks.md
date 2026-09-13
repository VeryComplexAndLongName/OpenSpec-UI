A run that crashes leaves its status file for good, and so does a write
that died between writing and renaming. Nothing removes either.

`an-agent-says-what-it-is-doing`, which this was blocked by, is archived.
Implemented after `a-status-write-never-stops-a-run`, whose queue and
retries the writer now has; the sweep's own removals follow the same
rule — a file in use for a moment is left for the next sweep.

## 1. The sweep

- [x] 1.1 `sweepAgentStatuses(directory, options)` in `agent-status.ts`,
  separate from `readAgentStatuses`, which stays a pure function. Both
  judge a record through one private `readAgentStatusRecord`; pinned by
  4.5.
- [x] 1.2 A record is removed only when, read again immediately before
  removal, its heartbeat is still past `AGENT_STATUS_STALE_AFTER_MS`. A
  record renewed in the meantime stays. Pinned by 4.2, through a
  `beforeReread` test seam.
- [x] 1.3 A temporary `*.tmp` file is removed when its modification time
  is older than the same window. The reader never sees these; nothing
  else removes them. Only a record's — a name with `.json.` in it and
  `.tmp` at the end; 4.3 keeps an unrelated old `notes.tmp`.
- [x] 1.4 A malformed record is never removed. It is evidence, and the
  reader keeps reporting it. Pinned by 4.4.
- [x] 1.5 Removing a file that is already gone is not an error: two
  sweeps at once are ordinary. Pinned by 4.6. A removal refused because
  the name is in use (`EPERM`, `EACCES`, `EBUSY`) is skipped the same way
  and left for the next sweep; no test refuses one.
- [x] 1.6 The result names what was removed — records and temporary
  files separately — so a caller can say so. `removedRecords` and
  `removedTemporaryFiles`; the CLI says each on stderr (2.2).

## 2. Where it runs

- [x] 2.1 `AgentStatusWriter.start()` sweeps once before writing its own
  first record. Best-effort; pinned by 4.7.
- [x] 2.2 The CLI status command sweeps before it reads. Removals are
  said on stderr, so stdout and `--format json` read as before;
  `status-command.test.ts` pins the order, the words, and that a failed
  sweep still answers.
- [x] 2.3 The pipeline tab's poll sweeps before it reads. The tab reads
  through `POST /api/worktree-survey`, whose handler now asks
  `surveyWorktrees` for `sweepStatuses: true`; the survey itself sweeps
  only when asked, so a reading stays a reading.
  `worktree-survey.test.ts` pins that a lapsed record goes only when
  asked, a live one stays, and git is asked for nothing more.
- [x] 2.4 No timer, no background task: the sweep runs only where the
  directory is already being looked at. By construction: the only
  callers are 2.1, 2.2 and 2.3.

## 3. No history in the status record

- [x] 3.1 The status record's shape carries no history, and a test pins
  its fields, so a later change that adds one fails here first. "writes a
  record that holds only the present: exactly these fields, and no
  history".
- [x] 3.2 A test shows a run's `started` entry reaches the audit log
  before the run ends — so a crash after it has already been recorded.
  `agent-runner.test.ts`: the adapter says `started` and waits; the log
  already holds `started` while it waits.

## 4. Tests

In `packages/core/src/agent-status-sweep.test.ts` unless named otherwise.
2026-09-13: 9 passed there, and with `agent-status.test.ts`,
`agent-status-writer-failures.test.ts`, `agent-runner.test.ts` and
`worktree-survey.test.ts` 72 in all; core typechecks; the touched files
lint.

- [x] 4.1 A record past the window is removed; one within it is not.
- [x] 4.2 A record stale at the first read and renewed before removal is
  kept.
- [x] 4.3 An old temporary file is removed; a fresh one is not.
- [x] 4.4 A malformed record past the window is kept and still reported.
- [x] 4.5 Reading never removes anything.
- [x] 4.6 Two concurrent sweeps over one directory both succeed. Its
  first version also claimed each removal is counted once, and failed on
  Windows: a second removal of a file whose first is still pending also
  succeeds, so both sweeps can name it. The test now checks that both
  succeed and only what was stale goes; exact counting would need a lock.
- [x] 4.7 A writer starting over a directory of stale records leaves only
  its own.

## 5. Verification

- [x] 5.1 This change validates strictly. `check(validate-change)`
  2026-09-13, after the tasks above were ticked: valid.
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. 2026-09-13,
  exit 0: typecheck and every lint passed; cli 134 tests (13 files),
  core 1220 (86), extension 327 (24), server 86 (4), webui 404 (43). The
  whole browser suite before it: 17 passed.
- [x] 5.3 A pending changeset exists. `check(changeset-present)`
  `.changeset/a-stale-status-is-swept.md`: core minor, cli and server
  patch.
- [x] 5.4 **Delegated to claude-cli**: start a real run, kill its
  process so it removes nothing, wait past the window, and run the status
  command. Evidence: the directory before and after, and what the command
  printed. Unit tests drive the sweep with files a test wrote; only a
  killed process shows that what a crash leaves is what the sweep
  removes.
  2026-09-13, by claude-cli, in a scratch repository
  (`%TEMP%\stale-sweep-live\repo`: one change `demo`, a per-change
  `harness.json` with `claude-cli` on every stage, autonomous, no
  checkpoints) with `OPENSPEC_UI_WORKTREE_ROOT` set to a scratch root, and
  a `claude.cmd` first on `PATH` that only waits ten minutes — a real
  chain and a real agent process, at no cost. Both CLI invocations ran
  from source, `node node_modules/tsx/dist/cli.mjs
  packages/cli/src/cli.ts`, since `packages/cli/dist` goes stale.
  `run demo --format json` printed `started` (chain), `stageStarted`
  apply `claude-cli`, `started` implement. With the stand-in running,
  `.agent-status` held one file,
  `edbfdf94-a071-48ff-b337-06dd0314d309.json`: activity `running apply`,
  stage `apply`, change `demo`, heartbeat `12:17:08.804Z`.
  `taskkill /T /F` on the run at 12:17:10Z ended six processes, the
  stand-in among them. Right after the kill the directory still held that
  one record, and it still did 30 s later, just before the status command:
  a crash removed nothing. `status --cwd <repo>` then printed, exit 0:
  `No runs are reporting themselves.` on stdout and
  `openspec-ui-cli: removed edbfdf94-a071-48ff-b337-06dd0314d309.json: its
  writer stopped reporting past the staleness window` on stderr. The
  directory afterwards: 0 entries. No temporary file was left, so the
  temporary-file half of the sweep is not shown by this run.
  Checked 2026-09-13 by a second agent against the agent's own session
  transcript, since the scratch repository was deleted afterwards. The
  script's output there holds the listing while running, the six
  terminations, the listing right after the kill and again at 12:17:41Z
  — 32.5 s past the heartbeat, beyond the 20 s window — the status
  command's two lines with exit code 0, and the empty listing after it.
  Every claim above is in it. The script captured both of the command's
  streams together, so which line went to stderr rests on
  `status-command.test.ts`, not on this run.

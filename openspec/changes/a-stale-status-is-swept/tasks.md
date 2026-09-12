A run that crashes leaves its status file for good, and so does a write
that died between writing and renaming. Nothing removes either.

Blocked by `an-agent-says-what-it-is-doing`, which is being implemented
and must be archived first.

## 1. The sweep

- [ ] 1.1 `sweepAgentStatuses(directory, options)` in `agent-status.ts`,
  separate from `readAgentStatuses`, which stays a pure function.
- [ ] 1.2 A record is removed only when, read again immediately before
  removal, its heartbeat is still past `AGENT_STATUS_STALE_AFTER_MS`. A
  record renewed in the meantime stays.
- [ ] 1.3 A temporary `*.tmp` file is removed when its modification time
  is older than the same window. The reader never sees these; nothing
  else removes them.
- [ ] 1.4 A malformed record is never removed. It is evidence, and the
  reader keeps reporting it.
- [ ] 1.5 Removing a file that is already gone is not an error: two
  sweeps at once are ordinary.
- [ ] 1.6 The result names what was removed — records and temporary
  files separately — so a caller can say so.

## 2. Where it runs

- [ ] 2.1 `AgentStatusWriter.start()` sweeps once before writing its own
  first record.
- [ ] 2.2 The CLI status command sweeps before it reads.
- [ ] 2.3 The pipeline tab's poll sweeps before it reads.
- [ ] 2.4 No timer, no background task: the sweep runs only where the
  directory is already being looked at.

## 3. No history in the status record

- [ ] 3.1 The status record's shape carries no history, and a test pins
  its fields, so a later change that adds one fails here first.
- [ ] 3.2 A test shows a run's `started` entry reaches the audit log
  before the run ends — so a crash after it has already been recorded.

## 4. Tests

- [ ] 4.1 A record past the window is removed; one within it is not.
- [ ] 4.2 A record stale at the first read and renewed before removal is
  kept.
- [ ] 4.3 An old temporary file is removed; a fresh one is not.
- [ ] 4.4 A malformed record past the window is kept and still reported.
- [ ] 4.5 Reading never removes anything.
- [ ] 4.6 Two concurrent sweeps over one directory both succeed.
- [ ] 4.7 A writer starting over a directory of stale records leaves only
  its own.

## 5. Verification

- [ ] 5.1 This change validates strictly. `check(validate-change)`
- [ ] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 5.3 A pending changeset exists. `check(changeset-present)`
- [ ] 5.4 **Delegated to `claude-cli`**: start a real run, kill its
  process so it removes nothing, wait past the window, and run the status
  command. Evidence: the directory before and after, and what the command
  printed. Unit tests drive the sweep with files a test wrote; only a
  killed process shows that what a crash leaves is what the sweep
  removes.

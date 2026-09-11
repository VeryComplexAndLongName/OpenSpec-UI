The lease records a host kind, a hostname and a pid, and the audit log
records nobody at all. Two people on one machine cannot tell whose run
holds the workspace, and there is no way to ask who does without trying
to start a run and being refused.

## 1. Who took it

- [x] 1.1 `WorkspaceLeaseDocument` gains an optional git identity —
  `user.email`, falling back to `user.name`. Optional because every
  lease written before this has none, and a directory with no identity
  configured must still be able to take one.
- [x] 1.2 Named and documented as **attribution, never authentication**.
  Anybody can set `user.email` to anything. The failure mode of
  recording it is not that it is wrong; it is that a later reader treats
  a self-declared label as an audit trail, so the message says "git
  author" and nothing is ever gated on it.
- [x] 1.3 Read once by whoever constructs the manager, not inside
  `acquireOrRenew`. That runs every five seconds while a run is active,
  and reading git config there would spawn a process twelve times a
  minute for a value that cannot change mid-run.
- [x] 1.4 `GitWrapper` gains a read of the configured identity. Absent
  config, absent git, or an error all mean none — never a guess.
- [x] 1.5 The three construction sites pass it: the CLI run, the
  standalone server's recovery service, and the extension's activation.
- [x] 1.6 `describeWorkspaceLeaseConflict` names it where present and
  reads the same without it.

## 2. Asking who holds it

- [x] 2.1 `openspec-ui-cli lease`: the holder's kind, host, pid,
  heartbeat age and git identity, or that the workspace is free.
- [x] 2.2 Exit `0` either way. The question was answered whether or not
  the workspace is held, and a script wanting "is it free" should read
  the output rather than infer from a failure code.
- [x] 2.3 `--format json` for a machine, the same shape the reader
  returns.

## 3. Clearing one

- [x] 3.1 `openspec-ui-cli lease release` clears only where the holder
  is established to be gone: the heartbeat is already stale, or the
  holder is on this hostname and its pid is not running.
- [x] 3.2 The liveness check does not signal the process.
  `process.kill(pid, 0)` answers it: `ESRCH` is no such process, `EPERM`
  is one that exists and belongs to somebody else.
- [x] 3.3 A holder on another hostname cannot be checked from here.
  Refuse and say that, rather than guess.
- [x] 3.4 A live holder is refused, and the message says stopping that
  process is the remedy. Taking its lease would let a second mutating
  run start against files it still has open, which is the whole point of
  the lease.
- [x] 3.5 Exit `0` cleared, `1` refused, `2` could not look.

## 4. Tests

- [x] 4.1 Core: a lease records the identity it was given, and one
  written without it stays readable.
- [x] 4.2 Core: the conflict description names the identity where
  present and reads correctly without it.
- [x] 4.3 Core: clearing a stale lease succeeds without consulting any
  process.
- [x] 4.4 Core: clearing is refused for a live pid on this hostname —
  driven with this test process's own pid, which is certainly alive.
- [x] 4.5 Core: clearing is refused for another hostname, saying it
  cannot be checked.
- [x] 4.6 Core: clearing a dead pid on this hostname succeeds. A pid
  that is certainly not running is needed, so the test must establish
  that rather than assume a number.
- [x] 4.7 CLI: `lease` exits 0 held and free; `lease release` exits 0,
  1 and 2 for the three outcomes.

## 5. Verification

- [x] 5.1 This change validates strictly. `check(validate-change)`
  `openspec validate --strict --changes` — 2 passed, 0 failed, this
  change among them.
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-11, exit 0. Typecheck and lint clean across all five packages
  (including `lint:english`, `lint:source-text`, `lint:changesets`).
  Tests: cli 107, core 1075, vscode 327, server 80, webui 379 — 1968
  across 155 files, 0 failed.
- [x] 5.3 A pending changeset exists. `check(changeset-present)`
  `.changeset/a-lease-says-who.md`: core and cli minor, the extension
  patch.
  A live smoke on the way past, recorded because it exercised the
  backward-compatible path for real rather than from a written file: the
  workspace was held by a VS Code extension built *before* this change,
  so its lease carries no identity. `lease` described it (exit 0) and
  omitted the git author line entirely; `lease release` refused it
  (exit 1) because its pid was running, naming stopping that process as
  the remedy. What this did NOT show is a lease written by this build,
  which is what 5.4 is for.
- [ ] 5.4 **Delegated to `claude-cli`**: with a real run holding a
  workspace, ask who holds it and try to clear it; then after that run
  ends, ask again. Evidence: the lease file, both outputs, and the exit
  codes. The unit tests drive the reader with written files; only a real
  run shows that the identity a chain records is the one the command
  reports.

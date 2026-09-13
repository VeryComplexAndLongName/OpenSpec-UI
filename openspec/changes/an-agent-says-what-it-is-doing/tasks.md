A hung agent looks exactly like a working one. Its heartbeat keeps
arriving because its process is alive, and `process.kill(pid, 0)` says
so too. The missing signal is not liveness but progress.

## 1. The record

- [ ] 1.1 `agent-status.ts` in core: a run writes what it is doing, its
  stage, its change, its working directory, and a heartbeat.
- [ ] 1.2 Named by the run's own identifier, generated at startup and
  shared with nobody — the device `WorkspaceLeaseManager` already uses
  for `holderId`. NOT by the person: one person routinely has two
  agents, and they would write to one file.
- [ ] 1.3 The identifier is repeated inside the record, so a record
  found under another identity is reported. Nothing prevents a process
  from writing a file it does not own; this is checked, not enforced.
- [ ] 1.4 Written to a temporary name and renamed into place. Otherwise
  a reader eventually parses half a file as a whole one.
- [ ] 1.5 Written beside the working directories, not inside one. A
  status inside is destroyed with the directory — which is how
  `audit.jsonl` came to be destroyed — and it matters most exactly when
  somebody is deciding whether to remove that directory.
- [ ] 1.6 Renewed on the lease's existing interval, and read as gone
  past the lease's existing staleness window. One meaning of "gone", not
  two.

## 2. Reading them

- [ ] 2.1 Every record of a repository, read as a pure function: the
  same answer for the shell, the terminal, and anything else.
- [ ] 2.2 Each carries how long since it last changed what it says it is
  doing.
- [ ] 2.3 No health verdict, anywhere. A long turn and a hang produce
  the same silence, and choosing between them is a person's judgement —
  the mistake this project already corrected in the words "user" and
  "owner".
- [ ] 2.4 An unreadable or malformed record is reported as such and does
  not remove the others.

## 3. Saying it

- [ ] 3.1 The chain reports its stage transitions into the record, so
  what it says it is doing is what it is doing.
- [ ] 3.2 Where an agent streams its own progress, the latest is carried
  — that is the line a person actually reads.
- [ ] 3.3 A run removes its record when it ends cleanly. Staleness
  covers the rest, because a crashed run removes nothing.

## 4. Showing it

- [ ] 4.1 A CLI command prints them: who, where, doing what, since when.
  Answerable without a browser, which is the case a person hits at the
  moment something is wrong.
- [ ] 4.2 Exit `0` whether or not anything is running. The question was
  answered either way — the rule `lease` and `ready` already follow.

## 5. Tests

- [ ] 5.1 Two runs by one person write two records and neither
  overwrites the other. This is the invariant the whole design rests on.
- [ ] 5.2 A record whose stated identity differs from where it was found
  is reported, not read as that run's.
- [ ] 5.3 A record whose heartbeat is past the window reads as gone, by
  the lease's own window.
- [ ] 5.4 A record is never observed half-written — driven by writing
  concurrently with reading.
- [ ] 5.5 The interval since the last change of activity is reported,
  and no field anywhere says stuck, hung or unhealthy. Asserted against
  the whole reported shape, because that field is the one somebody will
  helpfully add later.
- [ ] 5.6 A malformed record is reported and the others survive.
- [ ] 5.7 A working directory's removal leaves the records intact.
- [ ] 5.8 CLI: exits 0 with runs and without.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`
- [ ] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [x] 6.3 A pending changeset exists. `check(changeset-present)`
- [ ] 6.4 **Delegated to `claude-cli`**: with two real runs under way in
  two working directories, read the records and check each names the
  right change, the right directory and a moving activity; then let one
  end and read again. Evidence: both records over time, and what the
  command printed. The unit tests drive the reader with records a test
  wrote; only real runs show that what a chain reports is what a reader
  sees.

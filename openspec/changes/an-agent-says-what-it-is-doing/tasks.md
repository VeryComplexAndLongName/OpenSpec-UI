A hung agent looks exactly like a working one. Its heartbeat keeps
arriving because its process is alive, and `process.kill(pid, 0)` says
so too. The missing signal is not liveness but progress.

How this list was closed, stated once: the first pass was written by the
Harness (`claude-cli-acp`, 2026-09-12), whose apply stage ended its
session while its tests ran in the background and ticked nothing. Its own
verify stage — a second agent — read the code against every item and
recorded which hold. Items 1.1-2.4, 4.1-4.2 and 5.1-5.8 are ticked on that
review. Section 3 did not hold, for the reasons 3.4-3.7 record; those and
their tests were then done by hand and are ticked by the agent that did
them.

## 1. The record

- [x] 1.1 `agent-status.ts` in core: a run writes what it is doing, its
  stage, its change, its working directory, and a heartbeat.
- [x] 1.2 Named by the run's own identifier, generated at startup and
  shared with nobody — the device `WorkspaceLeaseManager` already uses
  for `holderId`. NOT by the person: one person routinely has two
  agents, and they would write to one file.
- [x] 1.3 The identifier is repeated inside the record, so a record
  found under another identity is reported. Nothing prevents a process
  from writing a file it does not own; this is checked, not enforced.
- [x] 1.4 Written to a temporary name and renamed into place. Otherwise
  a reader eventually parses half a file as a whole one.
- [x] 1.5 Written beside the working directories, not inside one. A
  status inside is destroyed with the directory — which is how
  `audit.jsonl` came to be destroyed — and it matters most exactly when
  somebody is deciding whether to remove that directory.
- [x] 1.6 Renewed on the lease's existing interval, and read as gone
  past the lease's existing staleness window. One meaning of "gone", not
  two.

## 2. Reading them

- [x] 2.1 Every record of a repository, read as a pure function: the
  same answer for the shell, the terminal, and anything else.
- [x] 2.2 Each carries how long since it last changed what it says it is
  doing.
- [x] 2.3 No health verdict, anywhere. A long turn and a hang produce
  the same silence, and choosing between them is a person's judgement —
  the mistake this project already corrected in the words "user" and
  "owner".
- [x] 2.4 An unreadable or malformed record is reported as such and does
  not remove the others.

## 3. Saying it

- [x] 3.1 The chain reports its stage transitions into the record, so
  what it says it is doing is what it is doing.
- [x] 3.2 Where an agent streams its own progress, the latest is carried
  — that is the line a person actually reads. The last complete line of
  output or of an agent's reply, and between sentences the tool it is
  running: an ACP update is read by `describeAcpUpdate`, the reader
  `an-agent-update-says-something` gave every surface (its task 4.4 moved
  here), so the record says `Bash: npm test` where the terminal does.
- [x] 3.3 A run removes its record when it ends cleanly. Staleness
  covers the rest, because a crashed run removes nothing.
- [x] 3.4 Every host keeps a record. *Found by the verify stage:* the VS
  Code extension ran its loop unwrapped, while `agent-status.ts` said
  every host wraps it. All three hosts now wrap their run loop with one
  core function, `withAgentStatus`, instead of the CLI and the server each
  carrying a copy of the fallback — the extension in `RunController`,
  which its chains pass through as well.
- [x] 3.5 Streamed output rewrites the record at most once a second, and
  its activity is a complete line. *Found by the verify stage:* every
  stdout chunk rewrote the file, and a chunk's last line became the
  activity even when the chunk ended mid-word. `activityAt` still moves
  the moment the activity changes; an unfinished reply counts as said
  once something else happens.
- [x] 3.6 Neither a run nor its events wait for the record. *Found by the
  verify stage:* the server's comment said the run started synchronously,
  while the first run per directory waited for `git worktree list`. Each
  event is queued behind the record's start and told to it as soon as it
  exists, so a run that goes quiet after its first events still shows
  them; the status directory is cached per working directory.
- [x] 3.7 Only a run keeps a record. A cancel, a read of a change or the
  answer to a checkpoint passes through untouched: a record started for
  one would never be ended by a terminal event of its own.

## 4. Showing it

- [x] 4.1 A CLI command prints them: who, where, doing what, since when.
  Answerable without a browser, which is the case a person hits at the
  moment something is wrong.
- [x] 4.2 Exit `0` whether or not anything is running. The question was
  answered either way — the rule `lease` and `ready` already follow.

## 5. Tests

- [x] 5.1 Two runs by one person write two records and neither
  overwrites the other. This is the invariant the whole design rests on.
- [x] 5.2 A record whose stated identity differs from where it was found
  is reported, not read as that run's.
- [x] 5.3 A record whose heartbeat is past the window reads as gone, by
  the lease's own window.
- [x] 5.4 A record is never observed half-written — driven by writing
  concurrently with reading.
- [x] 5.5 The interval since the last change of activity is reported,
  and no field anywhere says stuck, hung or unhealthy. Asserted against
  the whole reported shape, because that field is the one somebody will
  helpfully add later.
- [x] 5.6 A malformed record is reported and the others survive.
- [x] 5.7 A working directory's removal leaves the records intact.
- [x] 5.8 CLI: exits 0 with runs and without.
- [x] 5.9 Activity comes from a complete line, never from a chunk cut
  mid-word, and an unfinished reply counts once something else happens.
- [x] 5.10 Streamed activity rewrites the record at most once per
  interval, and still moves `activityAt` at once.
- [x] 5.11 `withAgentStatus` keeps a record named by the command's change
  and removes it on a clean end; delivers events while the directory is
  still being found; passes a non-run command through with no record;
  and lets a run go on unreported when no directory can be found.
- [x] 5.12 A tool call's line becomes the activity, and an update that
  says nothing leaves it.
- [x] 5.13 *Found by CI on the first pass:* the directory test built its
  paths from `C:`, absolute on Windows and relative on Linux, so it passed
  where it was written and failed in CI. Now resolved paths. Two
  `RunController` tests counted microtask ticks the extra wrapper
  outgrew; they now wait for the runner to reach its pause.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`
- [x] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-13, on this branch with `main` at #448 merged in, exit 0:
  typecheck in all five packages; English, source text, changesets,
  screenshots (22 of 22 captured) and test budgets passed. Tests: cli 132
  (13 files), core 1184 (83), extension 327 (24), server 84 (4), webui 396
  (43). The first pass had failed this in CI, on the `C:` path test 5.13
  records.
- [x] 6.3 A pending changeset exists. `check(changeset-present)`
- [x] 6.4 **Delegated to `claude-cli`** — *performed by the agent that
  finished the code, and closed on the owner's instruction; recorded
  rather than glossed, since the marking rule calls a self-close a rubber
  stamp.* With two real runs under way in
  two working directories, read the records and check each names the
  right change, the right directory and a moving activity; then let one
  end and read again. Evidence: both records over time, and what the
  command printed. The unit tests drive the reader with records a test
  wrote; only real runs show that what a chain reports is what a reader
  sees.

  2026-09-13, in a throwaway repository with two changes, each four
  tasks: wait 15 seconds, write a file, wait again, write another. The
  second working directory was made by the real `worktree add change-b`
  under a worktree root set through `OPENSPEC_UI_WORKTREE_ROOT`. Both
  chains ran at once through this branch's CLI sources, every stage
  `claude-cli-acp` on `claude-haiku-4-5-20251001`, no mocks. The records
  were read straight from `.agent-status` every two seconds, and
  `openspec-ui-cli status` was run at 20 s, at 45 s, after each chain
  ended and at the end. Paths are shortened; they named the account.

  **Two records, each its own.** From the first snapshot there were two
  files, `6db2dab4….json` naming `change-a` in `repo` and
  `f72120ab….json` naming `change-b` in `wt-root/repo/change-b`, and no
  other file in the directory at any snapshot — no temporary file left.

  **A moving activity**, change-b's record over the run (time, stage,
  activity):

  ```
  00:30:17  —       starting "change-b"
  00:30:21  apply   running apply
  00:30:29  apply   I should use the Write tool to create the files and Bash tool ...
  00:30:33  apply   Bash: node -e "setTimeout(() => {}, 15000)"
  00:31:13  apply   Write b1.txt
  00:31:17  apply   Bash: node -e "setTimeout(() => {}, 15000)"
  00:31:31  apply   Task 1.3 is done. Now I need to create b2.txt ...
  00:31:33  apply   Write b2.txt
  00:31:35  verify  running verify
  00:31:53  verify  Glob openspec/changes/change-b/specs/*/spec.md
  00:31:58  verify  Read b2.txt
  ```

  change-a's moved the same way on its own clock (`Read
  openspec/changes/change-a/tasks.md`, `Write a2.txt`, `Edit
  openspec/changes/change-a/tasks.md`). While a wait ran, `activityAt`
  stayed put and `heartbeatAt` moved every five seconds.

  **What the command printed while both ran**, at 45 s:

  ```
  6db2dab4-0611-45c9-9802-4d80610cf280 on "change-a" (apply)
      in <scratch>/repo
      Bash: node -e "setTimeout(() => {}, 15000)"
      said this 30s ago, last heard from 5s ago
  f72120ab-7da5-4699-9bf4-76d0e774d58f on "change-b" (apply)
      in <scratch>/wt-root/repo/change-b
      Bash: node -e "setTimeout(() => {}, 15000)"
      said this 32s ago, last heard from 5s ago
  ```

  Half a minute of silence under an unchanged activity with a live
  heartbeat, and no verdict — the case this change exists for.

  **One ends, and is read again.** change-a ended first; its record was
  gone from the next snapshot, and the command printed only change-b:

  ```
  f72120ab-7da5-4699-9bf4-76d0e774d58f on "change-b" (verify)
      in <scratch>/wt-root/repo/change-b
      Read b2.txt
      said this 5s ago, last heard from 4s ago
  ```

  Four seconds later change-b ended too, and the command printed `No
  runs are reporting themselves.`

  **Both chains exited 1, and not because of this change.** Each ended
  at `archive`: "cannot archive: 2 task(s) still unchecked" and "4
  task(s)". The apply agents did the work and ticked nothing, and haiku's
  verify stage would not tick a wait, which leaves no artifact to check.
  That is a finding about the chain's prompts and the tasks written for
  this check, recorded here and not fixed here. For this change it is
  useful evidence: a run that ends `failed` is a clean end, and both
  records were removed by it.

`verify` computes how many declared checks passed and failed, uses it to
decide whether to invoke the agent, and discards it. And a `verify` whose
checks failed writes no audit entry at all, because the entry is written
by the agent run that never happens.

## 1. Recording it

- [x] 1.1 The chain runner records the check outcome itself, as it
  already records the mechanical git actions — the precedent for
  mechanical work that no agent performed.
- [x] 1.2 Recorded whether or not the verifying agent then runs. The
  failing case is the one that records nothing today, and it is the case
  that found something.
- [x] 1.3 Nothing recorded where a change declares no checks. An entry
  saying nothing ran reads the same as one saying nothing failed.
- [x] 1.4 The counts ride on the entry as their own fields, not buried in
  a summary string. A number in prose is a number nothing can aggregate.
- [x] 1.5 The failures are named in the entry's reason, as the failure
  message already names them for the person watching.

## 2. Reading it back

- [x] 2.1 The per-change cost report shows the row, since it reads every
  entry for a change. Confirm it reads sensibly there rather than as
  noise — a row whose agent is not an agent needs to say what it is.
  It does, and by construction: the entry's agent is `verify-checks`,
  named that way for the reason `git-stage` is — an entry whose agent is
  not an agent says so in the field a reader looks at first. The row
  carries no usage, because nothing invoked a model, and the report
  already counts a row with no reported usage separately from one that
  reported zero.
- [x] 2.2 No aggregate analysis here. It needs the recording to exist and
  then to accumulate, and it will start empty.

## 3. Tests

- [x] 3.1 Checks that all pass record the count and no failures.
- [x] 3.2 A failing check records the counts and the reason, and does so
  even though the verifying agent never runs.
- [x] 3.3 A change with no declared checks records nothing.
- [x] 3.4 The entry carries the counts as fields, asserted as numbers
  rather than as text.

## 4. Verification

- [x] 4.1 `openspec change validate --strict verify-records-what-it-found`.
  Run 2026-09-09: valid.
- [x] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine, after the last edit.
  Run 2026-09-09 after the last edit: typecheck clean; lint clean with no
  warnings. Tests 48 cli, 752 core, 304 extension, 65 server, 305 webui
  — core up 3.
- [x] 4.3 Version bump via `npx changeset` for `core`.
  Done: `.changeset/verify-records-what-it-found.md`.
- [x] 4.4 `LIMITS.md` or `HARNESS.md` describes what the audit log holds.
  Correct whichever does.
  `LIMITS.md`, in "Where the numbers come from". It described every entry
  as an agent's run, which was already untrue of `git-stage` before this
  added a second such entry. It now says which entries are not agent runs
  and why they carry no usage.

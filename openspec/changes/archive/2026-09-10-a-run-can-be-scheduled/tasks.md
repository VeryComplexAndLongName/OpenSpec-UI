The argument the original note left open: what happens when the process
is not running. Answer — it starts at the next open, and says how late.

## 1. The schedule

- [x] 1.1 An entry is a change, a path, a time to start, and when it was
  asked for.
- [x] 1.2 Stored in `.openspec-ui/scheduled-runs.json`, gitignored beside
  the audit log: a schedule is one person's intent on one machine, not
  project configuration.
- [x] 1.3 Due is computed against the clock where it is read, never
  stored.
- [x] 1.4 An entry naming a change that no longer exists is dropped, and
  the drop is reported rather than silent.
- [x] 1.5 Several due at once: the oldest starts, the rest are reported
  as still waiting. The workspace lease already refuses a second mutating
  run, and failing against it would look like an error.

## 2. Asking for one

- [x] 2.1 The run dialog takes a time as well as a path — the same
  question, asked once.
- [x] 2.2 It says plainly that the application must be open, and what
  happens if it is not.
- [x] 2.3 A time already past is refused where it is entered, rather than
  scheduled and fired immediately.

## 3. Firing

- [x] 3.1 Checked when a host starts and on a tick while it runs.
- [x] 3.2 A due run opens the dialog it would have opened, showing that
  it was scheduled and for when.
- [x] 3.3 A late run says how late. Starting silently makes a schedule
  that half worked look like one that worked.
- [x] 3.4 Both hosts, from the same core function.

## 4. Tests

- [x] 4.1 Due and not due, against a fixed clock.
- [x] 4.2 An entry for a deleted change is dropped and counted.
- [x] 4.3 Two due at once: one starts, the other is reported waiting.
- [x] 4.4 A time in the past is refused.
- [x] 4.5 Lateness is carried, not rounded away.
- [x] 4.6 The file surviving a restart is what makes the late case work —
  asserted over a written file, not a value in memory.

## 5. Verification

- [x] 5.1 `openspec validate --strict --changes`.
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-09: exit 0 — 48 cli, 810 core, 308 extension, 70 server,
  343 webui.
- [x] 5.3 Version bump via `npx changeset`.
- [x] 5.4 `HARNESS.md`: where a schedule lives and what it depends on.
- [x] 5.5 Done by machine instead, in `e2e/scheduled-run.spec.ts`: one
  case waits out a real minute and watches it start unattended; the other
  writes a three-hour-old entry straight into the schedule, which is what
  a closed application leaves behind, and asserts the lateness on the
  next open. Run 2026-09-10: both pass, 2.5 minutes.

  It found two defects no unit test could have. The dialog lives in the
  change-editor tab, and a tab that is not active is not rendered — a
  schedule firing anywhere else consumed its entry and showed nothing.
  And the first pass ran before the workspace's changes were known, so
  every scheduled change looked deleted and its entry was removed. Both
  fixed here.

  The VS Code half stays unverified by machine: there is no browser
  driving the extension panel. Said rather than implied.

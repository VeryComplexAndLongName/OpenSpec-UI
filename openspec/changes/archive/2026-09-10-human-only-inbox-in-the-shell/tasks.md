Asked out loud on 2026-09-09 about six changes that were finished and
waiting: "six changes not started, is that deliberate?"

## 1. The collector

- [x] 1.1 One function in `core`, over the active changes, returning each
  item with its change, its line and its text.
- [x] 1.2 Archived changes are not read: archiving requires every task
  ticked, so there is nothing there by construction.
- [x] 1.3 A sentence that tells "nothing is waiting" from "nothing was
  read".
- [x] 1.4 The VS Code tree reads it instead of walking the workspace
  itself, and its tests move with the behaviour.

## 2. The shell

- [x] 2.1 A route, a client, and a block in the summary tab.
- [x] 2.2 Read when the summary is read — the same click, the same
  question.
- [x] 2.3 A failure to read it does not clear the summary.
- [x] 2.4 Nothing offers to tick an item.

## 3. Tests

- [x] 3.1 Items found across changes, each naming its change.
- [x] 3.2 A ticked item is left out; an ordinary open task is left out.
- [x] 3.3 The line number is carried, so a host can open the file at it.
- [x] 3.4 The two empty states read differently.
- [x] 3.5 The tree renders what the collector returns.

## 4. Verification

- [x] 4.1 `openspec validate --strict --changes`.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-10: exit 0 — 48 cli, 823 core, 308 extension, 70 server,
  346 webui.
- [x] 4.3 Version bump via `npx changeset`.
- [x] 4.4 Run it against this repository and record what it says.

  Run 2026-09-10: 4 active changes read, 1 item waiting on a person —
  `dependabot-block-action-majors` line 36, the weekly Dependabot run.
  Yesterday the same question took reading six task files by hand.

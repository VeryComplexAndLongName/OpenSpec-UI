Three things the delegated-item route knew and did not say, found on
2026-09-13 while handing two live checks to `claude-cli`.

## 1. The marker

- [x] 1.1 `delegatedAgentFor` names the same agent for a bare id and for
  the id enclosed in backticks. A private `unquoteAgentId` removes a
  backtick pair around the lead's last word before the unchanged match.
- [x] 1.2 A backtick on one side only names nothing. Nor does an empty
  pair.
- [x] 1.3 The inbox and the route read the marker the same way, since both
  go through `delegatedAgentFor`; a quoted marker on an open item is
  offered a run. Pinned in core by 5.4 and in the browser by 4.3.

## 2. Why a run failed

- [x] 2.1 `runDelegatedItem` keeps the last 20 lines, at most 2,000
  characters, of what the run wrote to stderr, from the run's own events.
  `StderrTail` holds at most four times the character bound while the run
  lasts, so a run printing megabytes never holds them.
- [x] 2.2 A `failed` or `cancelled` result carries them as `lastStderr`;
  a finished run carries none.
- [x] 2.3 The message quotes the last non-empty stderr line after the
  reason, and adds nothing when stderr was empty. Without a doubled full
  stop where the agent ended its own sentence.

## 3. A status record

- [x] 3.1 `runDelegatedItem` wraps the run in `withAgentStatus`, so the
  record names the change and exists for the length of the run.
- [x] 3.2 `onEvent` still sees every event, unchanged and in order.
- [x] 3.3 A `resolveStatusDirectory` test seam reaches `withAgentStatus`.

## 4. Where it shows

Added while implementing, for the owner's aim for this work: informative,
as visual as possible, convenient.

- [x] 4.1 The standalone inbox row keeps the whole result: its message
  and, for a run that stopped, what the agent last said, in a disclosure
  beneath the message. "What the agent last said", pre-formatted, wrapped
  and scrolled inside its own box; `e2e/waiting-on-inbox.spec.ts` "shows
  what a stopped run's agent last said, beneath the outcome" opens it.
- [x] 4.2 In VS Code a run that stopped is a warning, not an information
  message, and when the agent said something on stderr the notification
  offers "Show output", which writes it to the OpenSpec UI output channel
  and shows the channel. Typechecked; no test drives a VS Code
  notification's action.
- [x] 4.3 The browser suite's inbox fixture carries an item whose marker
  quotes its agent's id, and that row is offered a run. The fixture's
  fourth change `run-by-a-quoted-agent`; its row says "Run copilot-cli",
  and the basis now reads "4 items waiting" with "2 on copilot-cli".

## 5. Tests

2026-09-13: `task-checklist.test.ts` 30 tests, `human-only-inbox.test.ts`
18, `delegated-item-run.test.ts` 15, with the status writer's own files
96 in all, passed; core, webui, the extension and the server's browser
specs typecheck; the touched files lint.

- [x] 5.1 core `task-checklist.test.ts`: a bare id, a quoted id, a
  half-quoted id, and "whoever is free". The existing test keeps "whoever
  is free"; the new ones add the quoted, the half-quoted and the empty
  pair.
- [x] 5.2 core `delegated-item-run.test.ts`: a runner that writes to
  stderr and fails — the result carries the tail and the message quotes
  the last line; a long stderr is bounded; a finished run carries no tail.
  Bounded both ways: 50 lines keep the last 20, one 5,000-character line
  keeps 2,000.
- [x] 5.3 core `delegated-item-run.test.ts`: while a held runner is under
  way, a status record for the change exists in the directory the seam
  gave; after the run, it is gone.
- [x] 5.4 core human-only inbox test: an open item with a quoted marker
  is listed as delegated to that agent.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`
  2026-09-13, after the tasks above were ticked: valid.
- [x] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. 2026-09-13,
  exit 0: typecheck and every lint passed; cli 134 tests (13 files),
  core 1227 (86), extension 327 (24), server 86 (4), webui 404 (43).
- [x] 6.3 A pending changeset exists. `check(changeset-present)`
  `.changeset/a-delegated-run-says-what-happened.md`: core minor, webui
  and the extension patch.
- [x] 6.4 The whole browser suite, not a selected spec. 2026-09-13,
  `npm run test:browser` in `packages/server`: 18 passed (4.3m), exit 0.
  The four pictures it rewrote show no screen this change touches and
  were restored.
- [x] 6.5 **Delegated to `claude-cli`**: written with the quoted id on
  purpose. Through `/api/delegated-item/run`, run an open item in a
  scratch repository whose agent is a stand-in that prints a line to
  stderr and exits 1, and read `openspec-ui-cli status` while a second,
  waiting stand-in runs. Evidence: the route's result with its message
  and `lastStderr`, and the status output naming the change. The unit
  tests use fake runners; only the route shows that both hosts' path
  carries all three.
  2026-09-13, claude-cli. Setup: a scratch git repository
  (`%TEMP%/dr-check/repo`, outside this one) with two changes,
  `fail-on-stderr` and `wait-for-status`, each holding one open item
  whose marker reads ``**Delegated to `claude-cli`**``. The stand-in was
  a `claude.cmd` first on PATH, running a node script: for
  `wait-for-status` it printed one stdout line, waited 30 s and exited 0;
  otherwise it printed "stand-in: loading configuration" and an
  "API Error: 400 …" line to stderr and exited 1. Server from source
  (`tsx packages/server/src/cli.ts <repo> 47931`, since `npm run start`
  died in the Volta npm shim before reaching the product), with
  `OPENSPEC_UI_WORKTREE_ROOT=%TEMP%/dr-check/wt` for server and CLI
  alike; the CLI also from source (`tsx packages/cli/src/cli.ts`), so a
  stale `dist` could not mislead.
  - The quoted marker was read: both POSTs (`lineNumber` 2) ran, with
    `"agent":"claude-cli"`; neither was refused as naming no agent.
  - `fail-on-stderr`, HTTP 200: `"outcome":"failed"`,
    `"reason":"claude exited with code 1"`, `lastStderr` held both stderr
    lines ("stand-in: loading configuration", then "API Error: 400
    stand-in claude 0.0.1 does not support this model; version 9.9.9 or
    newer is required."), and `message` read "The run failed: claude
    exited with code 1. It last said: API Error: 400 stand-in claude
    0.0.1 does not support this model; version 9.9.9 or newer is
    required. Task 1.1 is still open." The stdout line was not in the
    tail.
  - `openspec-ui-cli status --cwd <repo>` at 17:00:03, while
    `wait-for-status` ran, exit 0: `330e6000-… on "wait-for-status"`,
    `in …\dr-check\repo`, activity "stand-in: waiting so a status record
    can be read", "said this 12s ago, last heard from 4s ago"; the
    record was `wt/repo/.agent-status/330e6000-….json`.
  - `wait-for-status` then returned `"outcome":"completed"` with no
    `lastStderr` and "The run finished. Task 1.1 is still open."; status
    at 17:00:23 said "No runs are reporting themselves.", exit 0.
  Only the standalone server's route was driven; the extension calls the
  same `runDelegatedItem` and was not started.
  Checked 2026-09-13 by a second agent against what the run left rather
  than this note: the stand-in script (one stdout line, then the two
  stderr lines and exit 1; the waiting branch 30 s and exit 0); the
  scratch repository's audit log, where both runs started as
  `claude-cli` on task 1.1 — so the quoted marker named its agent — and
  one failed with "claude exited with code 1" while the other completed;
  `wait-result.json`; and, in the agent's own session transcript, the
  failed run's HTTP 200 body with both stderr lines in `lastStderr` and
  the stdout line not in it, the status output at 17:00:03 naming
  `wait-for-status` with its record under `wt/repo/.agent-status`, and
  "No runs are reporting themselves." at 17:00:23.

## Context

See `proposal.md` and ADR 0039. What exists:

- `agent-status.ts`: each run's record carries `activity`, `activityAt`
  (changed only when the activity changes), `heartbeatAt`, `waiting`
  (`checkpoint` or `permission`) and `runId`. `readAgentStatuses` reads a
  directory of them; `change-readiness.ts` already reads them to decide
  which changes are running.
- `hints.ts`: `Hint { id, kind, subject, because, commands }`, derived by
  pure functions; `readPipelineReadiness` attaches them to the readiness
  report unless `hints.enabled` is `false`; `HintList` renders them in
  both hosts; `openspec-ui-cli advise` prints them.
- `agent-runner.ts`: every run of every agent passes through
  `createAgentRunner`'s `run`, which writes the terminal audit entry with
  the run's `reason`. A spawned CLI's failure reason is
  `<executable> exited with code N`; its stderr arrives as `stderr`
  events before it.
- `last-runs.ts`: each change's last ended run, read from every
  worktree's audit log, cached by size and time; `change-card.ts` turns it
  into "last run failed at apply".
- The audit log's failure reasons in this repository on 2026-10-04:
  `claude exited with code 1` (twice), `ACP connection closed`,
  `Authentication required`, and chain refusals.

## Goals / Non-Goals

**Goals:**

- A failure says whether repeating can help, from what the run printed.
- A silent run and a waiting run are pointed out, with the fact and the
  commands.
- One place computes each, and every surface shows the same words.

**Non-Goals:**

- Stopping, restarting or switching anything. `advise` writes nothing.
- A model judging anything.
- A timer or a poll of its own: the suggestions are computed where a
  reading is already made.
- `act` and fallback agents (`the-supervisor-changes-agents`).
- Diagnosing a cancelled run: a cancellation already names its ceiling
  or reads as a person's.

## Decisions

1. **The diagnosis is computed once, in the agent runner.**
   - Chosen: `createAgentRunner` keeps the last 8 KiB of the run's
     `stderr` and `stdout` text and, on `failed`, calls
     `diagnoseFailure({ agentId, reason, output })`, attaches the result
     to the event it yields and to the terminal audit entry.
   - Rejected: diagnosing in each host. Three copies of one rule drift.
   - Rejected: diagnosing in each adapter. Most failures are a process's
     exit, which the shared spawn path produces without knowing the agent.
   - The chain's own ending entry copies the failed stage's diagnosis, so
     `lastRunsOf`, which prefers that entry, still has it.

2. **The diagnosis is a closed set of causes, matched by text seen.**
   `failure-diagnosis.ts` is a leaf (no Node imports), so the browser
   renders its words.

   | Cause | Repeat helps | Matched on (case-insensitive) |
   | --- | --- | --- |
   | `agent-not-installed` | no | `ENOENT`, `not recognized as an internal or external command`, `command not found` |
   | `not-signed-in` | no | `Authentication required`, `not logged in`, `please log in`, `/login`, `Unauthorized`, `invalid api key`, status 401 |
   | `blocked-by-the-machine` | no | `EPERM`, `EACCES`, `Access is denied`, `operation not permitted` |
   | `network-unreachable` | no | `ECONNREFUSED`, `ECONNRESET`, `ENOTFOUND`, `ETIMEDOUT`, `EAI_AGAIN`, `fetch failed`, `proxy` |
   | `rate-limited` | likely | `rate limit`, `Too Many Requests`, `quota`, status 429 |
   | `server-error` | likely | `Internal Server Error`, `Service Unavailable`, `Bad Gateway`, `Gateway Timeout`, `overloaded`, status 500, 502, 503, 504 |
   | `unknown` | unknown | anything else |

   Each match quotes the line it was found in (up to 200 characters), so a
   reader can check it. A status code counts only after `HTTP`, `status`,
   `code` or `error`, or before its own phrase: a bare number in output is
   usually a duration or a count. The first cause in table order wins: a
   run that could not start explains whatever followed.
   The remedy names the agent's executable from the registry where it has
   one ("run `claude` in a terminal and sign in"), and for the network it
   names `openspec-ui.agents.ignoreSystemProxy` and
   `OPENSPEC_UI_IGNORE_SYSTEM_PROXY`.

   `network-unreachable` repeating "no" is deliberate: a repeat into the
   same proxy or the same down server fails the same way, and the person
   has something to do first.

3. **The supervisor is a pure function over records.**
   `supervisor.ts` (leaf): `superviseRuns({ statuses, lastRuns, config,
   now })` returns `Hint[]` of three new kinds:
   - `run-says-nothing-new`: not `gone`, no `waiting`,
     `activitySinceMs > silentAfterSeconds * 1000`. Commands:
     `openspec-ui-cli status --cwd <dir>` and
     `openspec-ui-cli stop <instanceId> --reason "<words>" --cwd <dir>`.
   - `run-waits-on-you`: `waiting` set, waiting longer than
     `waitingAfterSeconds`. Measured from `activityAt`. A checkpoint
     already set an activity of its own when the wait began; a permission
     did not, so it now sets "waiting for a permission", and `activityAt`
     is when either wait began. Command: `openspec-ui-cli status`.
   - `last-run-cannot-be-repeated`: a change's last run failed with a
     diagnosis whose repeat helps `no`, and no live record names the
     change. Commands: the remedy's, where it has one.

   Ids are stable for the same facts (`run-says-nothing-new:<instanceId>`,
   `last-run-cannot-be-repeated:<change>:<runId>`), so a surface keyed on
   them does not reshuffle.

4. **They ride the existing payload.** `readPipelineReadiness` appends
   `superviseRuns(...)` to `buildHints(...)`; `advise` does the same
   through one exported `readSupervisorHints(workspaceRoot, config)`, which
   also reads the supervisor of each change a record or a last run names. `hints.enabled:
   false` still means no suggestions at all; `supervisor.mode: "off"` means
   none of the supervisor's.

5. **`supervisor` in the harness configuration.**
   `{ mode?: "off" | "advise", silentAfterSeconds?: positive integer,
   waitingAfterSeconds?: positive integer }`. Absent is `advise`, 600 and
   60. Accepted in both files; a per-change object is merged key by key
   over the global one, like `branches`. Any other `mode` is refused where
   the configuration resolves: a setting that cannot act is not accepted
   quietly.

6. **Surfaces.**
   - Card: `describeLastRun` appends the diagnosis ("last run failed at
     apply 3 min ago — not signed in: repeating will not help").
   - The run's log: its end record carries the diagnosis.
   - Run panels (`HarnessChainPanel`, the AI panel, the run log view):
     where a failure is shown, its diagnosis is shown beneath it, by one
     shared component, `FailureDiagnosisNote`.
   - `openspec-ui-cli run`: the failure line is followed by the
     diagnosis lines.
   - Harness Settings (global and change): a "Supervisor" select, Advise
     or Off, saved with the rest.

## Risks / Trade-offs

- **A pattern can be wrong.** `401` inside a file name or a test count
  would read as "not signed in". Whole-word matching and quoting the line
  make it checkable, and the word is a diagnosis, never an action.
- **The output tail is the end of what the run printed**, which is where a
  CLI prints its fatal error, but not always. An error printed early and
  followed by much output is missed and reads `unknown`.
- **A threshold is checked when a reading is made.** The Pipeline reads on
  its survey interval, so a run is pointed out within one interval after
  it crosses the threshold.
- **A long command is silent.** `npm test` running ten minutes inside an
  agent is indistinguishable from a hang; that is why it is a suggestion
  with the last activity quoted, and why the threshold is configurable.

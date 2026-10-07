## Why

Feedback from a tester on 2026-10-07, running one change through the
Pipeline:

- The card moved to In progress when they ran `propose`, and stayed there
  after it, never reaching Proposed or Planned. Every run in the audit log
  counted as work on the implementation, and a stage only moves forward.
- "The additional frames around every message make the output difficult to
  read": the log drew each event as a framed box.
- A review's result was shown twice or three times - in the status line,
  in the run analysis and in the log - and its Markdown was not rendered:
  headings, bold and lists ran together as one paragraph.
- The run analysis said "Steps: 0" for a run full of tool calls: it counted
  only numbered lists a text agent printed.

## What Changes

- A run counts toward In progress only where it worked on the
  implementation: an `implement` or `verify` run, a chain's `apply`,
  `verify` or `git` stage, the verify checks, or a run on one task. Each
  run's audit entry now records its command, so the board can tell.
- The AI panel's status line says `Completed`; the result is drawn once,
  in a Result section, as Markdown; the run analysis counts tool calls and
  no longer repeats the result; the log leaves out the result and draws
  what the agent said as text and its tool calls as quiet lines, without
  frames. The chain panel's log reads the same way.

## Capabilities

### Modified Capabilities

- `execution-core`: which audit entries move a change In progress.
- `shared-ui`: how a run's result and its log are drawn.

## Impact

- `packages/core`: `security.ts` (`AuditEntry.command`), `agent-runner.ts`,
  `audit-runs.ts` (`isWorkEntry`, `workTimestampsByChange`),
  `change-stages.ts`.
- `packages/webui`: `AiPanel.tsx`, `HarnessChainPanel.tsx`, `shell-ui.ts`.

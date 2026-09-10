# @openspec-ui/server

## 1.18.0

### Minor Changes

- 9dd0767: A name arriving from a request is checked before it is used. A change
  name now passes the change-name rule before it is joined into a path,
  in core beside the path it protects, so a message naming
  `../../../../Users/me/.claude` no longer decides where a `harness.json`
  is written — the bridge answers `ok: false` and the REST routes answer
  400, both carrying the rule the name broke. A schedule entry is
  validated on the way in by the same rule the reader applies on the way
  out, so a stored row and the response that reported it can no longer
  disagree, and a body asking for an addition and a removal at once is
  refused rather than half-applied. A `customAgent` obeys the same shape
  rule as a model id, for the same reason: both reach the CLI as the value
  of a flag, and a value beginning with `-` may be read as a second one. A
  custom-agent definition whose file name that rule refuses is reported as
  found and not offered, rather than dropped in silence.

### Patch Changes

- c679bd4: A scheduled run keeps the promise the dialog makes. Opening the
  application is now enough: the workspace is read on open, so the
  schedule is read too and a due run starts with nothing else done — it
  used to wait for a click that a real reopen never makes. The run starts
  on the path that was chosen when it was scheduled rather than reopening
  the dialog for the same choice, and the entry leaves the file only once
  the run has been opened, so a configuration that cannot be resolved
  reports itself as a run that could not be opened instead of consuming
  the schedule under the wrong message. A change archived after being
  scheduled is dropped and says it was archived, and a run due behind it
  starts on the same reading. Firing is decided once, in
  `planScheduleFiring` in core, with each host performing only the
  effects it is handed. The dialog is announced as a dialog and takes
  focus when it opens by itself, and what the schedule did is readable
  from any tab of the standalone shell.
- Updated dependencies [be28986]
- Updated dependencies [9dd0767]
- Updated dependencies [1b67bee]
- Updated dependencies [c679bd4]
- Updated dependencies [ad1a8ae]
  - @openspec-ui/core@0.63.0

## 1.17.0

### Minor Changes

- 93b544d: Read back what the verifying stages found, and what is waiting on a
  person.
  
  The audit log has recorded `checksRan` and `checksFailed` since
  verify-records-what-it-found and nothing read them. They now appear per
  agent beside what runs cost — an agent that is cheap and fails its checks
  is not the cheap one. Measured on this repository first: 0 of 108 entries
  carry the fields, because no chain has verified since the recording
  landed, so the surface says which nothing that is rather than showing a
  blank.
  
  Unticked human-only items are readable in the standalone shell too. A
  change waiting on a live check and a change nobody has started are the
  same row in a list of changes — a question this repository was actually
  asked, about six changes that were finished. The collecting moved into
  `core`, so both hosts read one answer instead of one host walking the
  files itself.
  
  Also here, from automating a human-only check: a scheduled run firing
  while another tab was open consumed its entry and displayed nothing, and
  the first schedule read ran before the workspace's changes were known and
  deleted every entry as belonging to a deleted change.

### Patch Changes

- Updated dependencies [93b544d]
  - @openspec-ui/core@0.62.0

## 1.16.0

### Minor Changes

- 71e0051: A run can be asked for at a time, and says what became of it.
  
  The run dialog now takes a time as well as a path — the same question,
  asked once. The schedule lives in `.openspec-ui/scheduled-runs.json`,
  gitignored beside the audit log, because "start this one at six" is one
  person's intent on one machine rather than project configuration.
  
  `one-way-in-to-run` left this open with the argument it turns on: what
  happens when the process is not running. The answer here is that the run
  starts the next time the application is opened, and the dialog says how
  late it is — a schedule that quietly does not happen is worse than no
  schedule, so the dialog also says, before anyone relies on it, that it
  needs the application open.
  
  A time already past is refused where it is entered. Where several come
  due together one starts and the rest are reported as waiting, because the
  workspace lease refuses a second mutating run and that refusal would read
  as a fault. An entry for a change that no longer exists is dropped and the
  drop is reported.
  
  Both hosts fire from the same core function, on start and on a tick.

### Patch Changes

- Updated dependencies [71e0051]
  - @openspec-ui/core@0.61.0

## 1.15.1

### Patch Changes

- Updated dependencies [6abc8fa]
  - @openspec-ui/core@0.60.1

## 1.15.0

### Minor Changes

- 8987e8b: Choose a custom agent where the stage's agent is chosen.
  
  `POST /api/custom-agents` returns the definitions a workspace holds, with
  the directories they were looked for in, and the harness settings offer
  one picker per stage — listing only the definitions that stage's own CLI
  accepts.
  
  Nothing is offered as an empty control: a stage whose agent takes none
  says so, a workspace defining none says so and names the directories
  read, and a configured name the discovery no longer finds stays selected
  and is marked as not found rather than being replaced.
  
  Saving a stage now keeps a `model` this form has no control for. It was
  being deleted on save — the same defect as `settings-save-what-was-shown`,
  one level down in the stage entry.

### Patch Changes

- Updated dependencies [db5e02c]
- Updated dependencies [f4beaaf]
- Updated dependencies [8987e8b]
- Updated dependencies [09a49fd]
  - @openspec-ui/core@0.60.0

## 1.14.0

### Minor Changes

- a107503: The run dialog shows what runs have cost in this workspace: per agent,
  with the median and p90 cost and duration, how many runs each figure
  rests on, and how many of those reported a cost at all. An agent that
  reports nothing says so rather than showing a cost of zero, and a group
  resting on fewer runs than the threshold is marked rather than omitted.
  
  A workspace with nothing recorded says so and states how many audit
  entries were read, so the box changes as runs accumulate instead of
  looking identical before and after one has happened.
  
  New route `POST /api/workspace-run-stats`, since the figures come from
  the audit log and from which changes still exist, and the browser can
  read neither.

### Patch Changes

- Updated dependencies [8f2ed11]
- Updated dependencies [cba553e]
- Updated dependencies [d1e15ca]
  - @openspec-ui/core@0.59.0

## 1.13.27

### Patch Changes

- Updated dependencies [94a295e]
- Updated dependencies [9f323c1]
  - @openspec-ui/core@0.58.0

## 1.13.26

### Patch Changes

- Updated dependencies [9836f84]
- Updated dependencies [dea1dc4]
  - @openspec-ui/core@0.57.0

## 1.13.25

### Patch Changes

- Updated dependencies [4115954]
  - @openspec-ui/core@0.56.0

## 1.13.24

### Patch Changes

- 878db9c: Bound a harness run in time. `timeout.maxRunSeconds` and
  `timeout.maxStageSeconds` cap a whole chain and a single stage, both optional and
  absent-means-unbounded, settable globally and per change.
  
  Unlike a spending ceiling, this one stops a stage that is already running:
  elapsed time is known during a run where a run's cost is not. It is also the only
  ceiling with any force over an agent that reports no usage — six of the ten
  supported report nothing, and no ceiling of any kind was in force over them
  before. Time counts while a stage runs and not while the chain waits at a
  checkpoint, so a person deliberating is never charged for it.
  
  Reaching a ceiling ends the run as *cancelled* with a reason naming the ceiling
  and its value, rather than as a failure: `CancelledEvent` gains an optional
  `reason`, and an absent one keeps meaning "a person asked". `maxStageAttempts`
  allows a cut stage to be attempted again — one number covering every reason a
  stage is retried, with each attempt recording why the previous one ended. A stage
  that failed on its own merits is not retried. The usage summary gains an
  elapsed-against-ceiling row and shows which attempt a stage is on.
- Updated dependencies [2074915]
- Updated dependencies [7aae888]
- Updated dependencies [c26dea5]
- Updated dependencies [878db9c]
- Updated dependencies [182f22e]
- Updated dependencies [695bf32]
- Updated dependencies [c3963c9]
- Updated dependencies [ea25d08]
- Updated dependencies [a82b322]
- Updated dependencies [ba09225]
- Updated dependencies [960b489]
  - @openspec-ui/core@0.55.0

## 1.13.23

### Patch Changes

- Updated dependencies [5b61c75]
  - @openspec-ui/core@0.54.0

## 1.13.22

### Patch Changes

- 53a9f7d: Fix a chain run hanging forever when its agent asks for permission: `HarnessChainRunner` now routes a `"resolvePermission"` command to the runner executing the stage in flight (mirroring how `"cancel"` is already routed), instead of rejecting it as a non-`"chain"` command. Both hosts (`packages/server`'s WebSocket dispatcher and the VS Code extension's webview message handler) gain the matching routing branch, and `HarnessChainPanel` gains the Allow/Deny control needed to answer. A permission request raised under `autonomyLevel: "autonomous"` — where there is no confirmation channel — now fails the stage with a stated reason and ends the underlying process, instead of waiting on a promise nothing can resolve.
- Updated dependencies [53a9f7d]
  - @openspec-ui/core@0.53.0

## 1.13.21

### Patch Changes

- Updated dependencies [12b730b]
  - @openspec-ui/core@0.52.0

## 1.13.20

### Patch Changes

- Updated dependencies [e78face]
- Updated dependencies [bfad445]
  - @openspec-ui/core@0.51.0

## 1.13.19

### Patch Changes

- Updated dependencies [af32105]
- Updated dependencies [a61bfbe]
- Updated dependencies [ae78a82]
  - @openspec-ui/core@0.50.0

## 1.13.18

### Patch Changes

- Updated dependencies [2ec29df]
  - @openspec-ui/core@0.49.0

## 1.13.17

### Patch Changes

- Updated dependencies [4e59bdf]
- Updated dependencies [4e59bdf]
  - @openspec-ui/core@0.48.0

## 1.13.16

### Patch Changes

- Updated dependencies [eca84bc]
- Updated dependencies [d161b50]
  - @openspec-ui/core@0.47.0

## 1.13.15

### Patch Changes

- Updated dependencies [348ee61]
- Updated dependencies [348ee61]
  - @openspec-ui/core@0.46.0

## 1.13.14

### Patch Changes

- Updated dependencies [5271dfe]
  - @openspec-ui/core@0.45.0

## 1.13.13

### Patch Changes

- Updated dependencies [366bb77]
  - @openspec-ui/core@0.44.0

## 1.13.12

### Patch Changes

- Updated dependencies [8a69ea0]
  - @openspec-ui/core@0.43.0

## 1.13.11

### Patch Changes

- Updated dependencies [5cddc4d]
  - @openspec-ui/core@0.42.0

## 1.13.10

### Patch Changes

- Updated dependencies [144e13b]
  - @openspec-ui/core@0.41.0

## 1.13.9

### Patch Changes

- ed9e4c9: Audit records now survive a host restart. `FileAuditLog` (packages/core/src/security.ts) gains a bounded, rotating JSONL file (oldest entries dropped first, never the whole file) and a `readEntries()` to read them back. Both `packages/server` (`cli.ts`, and `optional-server.ts` on the extension side) and `packages/extension`'s direct-import mode (`extension.ts`) now construct a `FileAuditLog` under the workspace's `.openspec-ui/audit.jsonl` and share it between the runners it audits and `HarnessChainRunner`'s `listAuditEntries`, so a configured spending ceiling sums a change's persisted history across restarts rather than resetting on every editor close. `core` also exports `auditLogPath(workspaceRoot)`, the one place this file's location is decided. No change to what is recorded, to `buildUsageReport`, or to the budget's comparison logic — only to whether the records outlive the process that wrote them.
- Updated dependencies [ed9e4c9]
  - @openspec-ui/core@0.40.0

## 1.13.8

### Patch Changes

- Updated dependencies [80a097b]
  - @openspec-ui/core@0.39.0

## 1.13.7

### Patch Changes

- Updated dependencies [d0be00e]
  - @openspec-ui/core@0.38.0

## 1.13.6

### Patch Changes

- Updated dependencies [8f60b09]
  - @openspec-ui/core@0.37.0

## 1.13.5

### Patch Changes

- Updated dependencies [dc71cec]
  - @openspec-ui/core@0.36.0

## 1.13.4

### Patch Changes

- Updated dependencies [6ed2d1a]
  - @openspec-ui/core@0.35.0

## 1.13.3

### Patch Changes

- Updated dependencies [d15f4cb]
  - @openspec-ui/core@0.34.1

## 1.13.2

### Patch Changes

- Updated dependencies [6b13d58]
- Updated dependencies [d9084ab]
- Updated dependencies [db0e717]
- Updated dependencies [6b13d58]
  - @openspec-ui/core@0.34.0

## 1.13.1

### Patch Changes

- Updated dependencies [5ce55ae]
  - @openspec-ui/core@0.33.2

## 1.13.0

### Minor Changes

- be47425: Make the Agentic Harness's `semi-autonomous`/`autonomous` autonomy levels
  functional. A new `"chain"` command runs `propose -> review -> apply ->
  archive` for a change in sequence, pausing at an explicit `checkpoint`
  between stages by default (`semi-autonomous`) or continuing immediately via
  `stageCompleted` (`autonomous`, or a per-change `harness.json` setting
  `checkpoints.requireConfirmationBetweenSteps: false`). `autonomous` is
  reachable only through an explicit per-change `openspec/changes/<id>/
  harness.json` — never the global `openspec/agent-harness.json`, and never
  implied by any other setting.
  
  See `docs/adr/0012-agentic-harness-chain-execution-protocol.md` and
  `openspec/changes/agentic-harness-autonomy/` for the full design. A chain
  always stops after `archive` and never invokes the `git` stepAgent —
  commit/push automation remains fully out of scope, deferred to its own
  future change. The "Run with Agentic Harness" UI entry point that starts a
  chain from either delivery target is also a separate, dependent follow-up
  (`openspec/changes/agentic-harness-run-menu/`); this release only adds the
  protocol and a minimal, not-yet-wired-up `HarnessChainPanel` component.

### Patch Changes

- be47425: Add a discoverable "Run with Agentic Harness" entry point for the chain
  execution `agentic-harness-autonomy` introduced: a new context-menu command
  (`openspec-ui.runWithHarness`) in the VS Code extension, and a matching
  button in the standalone shell's Change Editor tab. Both resolve the
  selected change's Agentic Harness configuration fresh on every invocation
  and dispatch accordingly — the existing Agent Selection picker for
  `assisted`, or the `HarnessChainPanel` chain view for `semi-autonomous`/
  `autonomous` — without ever overriding what that configuration says.
  
  See `openspec/changes/agentic-harness-run-menu/` for the full design. No
  protocol change — this is purely a discoverable trigger over what
  `agentic-harness-autonomy` already exposes.
- Updated dependencies [be47425]
- Updated dependencies [be47425]
  - @openspec-ui/core@0.32.0

## 1.12.0

### Minor Changes

- 3a93782: Add the Agentic Harness (assisted level): a two-level (global +
  per-change), product-owned config that recommends a CLI agent per
  OpenSpec-change stage in the Agent Selection picker, and shows which
  agent ran a process plus its percent-complete in the Processes view.
  Configurable via a new "Harness Settings" GUI in both delivery targets.
  
  See `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` and
  `openspec/changes/agentic-harness/` for the full design. Only the
  `assisted` autonomy level is functional in this release —
  `semi-autonomous`/`autonomous`/the `git` stepAgent action/parallel task
  execution are accepted in the config schema for forward compatibility
  but not yet implemented, and are visibly marked as such in the Harness
  Settings UI.
- da70d78: Standalone app's "OpenSpec view summary" tab now renders active and
  archived changes as searchable lists (by name or status), using the
  shared `ChangesList`/`ArchiveList` components instead of a static table;
  archived changes now show real task progress and a last-modified date.

### Patch Changes

- Updated dependencies [3a93782]
- Updated dependencies [da70d78]
  - @openspec-ui/core@0.31.0

## 1.11.0

### Minor Changes

- Add a cross-host workspace lease (docs/adr/0010-cross-host-workspace-lease.md) so at most one host process — a VS Code extension or a standalone server, pointed at the same workspace — can run a mutating operation at a time. A blocked host gets an immediate, actionable error naming the other host instead of racing it or queuing forever. The standalone server's own `implement` execution is now routed through the same mutation lock and lease (it previously bypassed the scheduler entirely), closing a pre-existing same-host gap alongside the cross-host one.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.30.0

## 1.10.0

### Minor Changes

- Add a downloadable sprint summary PDF report: for a user-picked date
  range and set of changes, who authored each one (from git), what it
  was, task completion, plus aggregate statistics (total changes, tasks
  completed in range, a per-author breakdown). New "Sprint report" mode
  in the standalone Timeline tab.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.29.0

## 1.9.0

### Minor Changes

- Add a best-effort, git-derived change timeline data layer: created date,
  archived date, and a per-task completion date (via `git blame` on
  `tasks.md`, `null` for still-pending tasks), plus proposal/design/spec
  content in one read. New `getChangeTimeline`/`getChangeTimelines` in
  `@openspec-ui/core`, `POST /api/change-timeline`/`/api/change-timelines`
  in the standalone server, and a matching webui client. No UI yet — this
  is the shared data layer for a "change timeline" view, coming next.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.27.0

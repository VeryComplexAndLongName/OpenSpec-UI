# Design

See `docs/adr/0029-the-pipeline-is-where-a-change-is-run.md`, "The
Pipeline is one tab, in both hosts, drawn by one component".

## Context

- **How `PipelineView` gets its data.** It never fetches anything itself;
  it calls the `load` and `survey` functions it is given. It re-reads
  every 10 seconds (`PIPELINE_POLL_INTERVAL_MS`) and every 30 seconds
  (`SURVEY_POLL_INTERVAL_MS`), and only while `isActive`. The standalone
  shell passes REST clients as `load` and `survey`.
- **The standalone server's routes.** The readiness route calls
  `readChangeReadiness`, then `buildHints` when the harness configuration
  does not turn hints off, and sends the report with a `hints` key only
  when hints are on. The survey route calls
  `surveyWorktrees({ workspaceRoot, sweepStatuses: true })`.
- **What the extension has.**
  - Two `createWebviewPanel` calls: the AI panel, which talks over the
    message bridge, and the timeline, which renders data embedded once.
  - A bridge request channel (`openspec-ui/request` and
    `openspec-ui/response`) with a 10-second timeout. It offers named
    operations only, and the host answers them against its own workspace
    root.
  - A watcher on `openspec/**` that refreshes six trees.
  - Nothing that watches the status directory. That directory lies
    outside the workspace, beside the repository's working directories.
- **Status records are rewritten often.** Every five seconds per run, by
  its heartbeat, and as often as once a second while the run streams
  output.
- **The survey is costly.** It runs `git worktree list` and reads the
  configured git identity: two subprocesses per reading.

## Decisions

### A panel of its own

`openspec-ui.openPipeline` opens one `openspecUiPipeline` webview panel per
window. When the panel already exists, the command reveals it.

- **Rejected: a tab inside the AI panel.** ADR 0003 rejects putting the
  workbench into one webview. The AI panel is a run surface that is
  re-rendered for each run's context.
- **Rejected: a sidebar `WebviewView`.** A picture made of columns needs
  editor width. At sidebar width, the layout from ADR 0025 would
  permanently fall back to its narrow list.

### A bundle of its own

`packages/webui/src/pipeline-entry.tsx` is bundled to `dist/pipeline.js`
by `pipelineWebviewBuildOptions`.

- **Rejected: reusing `webview.js`.** That bundle carries the AI panel,
  the run dialog and the settings view, and shares one context message
  shape with them.
- **Cost.** One more copy of React in the package, about 1.3 MB, the same
  cost the timeline bundle already pays.

### Readings over the request channel

The panel answers two new operations:

- `pipeline/readiness` returns `readPipelineReadiness(workspaceRoot)`.
- `pipeline/survey` returns a survey.

The workspace root is the host's own. No message names a path.

- **Rejected: embedding the readings in the HTML, as the timeline does.**
  The picture would never update.

### One readiness payload, assembled in core

`readPipelineReadiness` returns the report, with hints when the
configuration does not turn them off. The standalone route and the panel
both call it.

- **Rejected: a copy of the hints switch in the extension.** Two copies of
  one promise, "off means not computed", would drift apart. ADR 0001 keeps
  behaviour in core.

### Files decide when to re-read

While the panel is visible, the host watches two things:

- `openspec/changes/**` under the workspace root, which re-reads both
  readings;
- `*.json` in the status directory, which re-reads the survey only.

Events within one second of each other become one message. A backstop
re-reads both readings every 60 seconds, for changes that raise no file
event: git's list of working directories, and records or leases going
stale.

- **Rejected: polling, as the standalone shell does.** It runs git every
  10 seconds while nothing has changed.

### A record event re-reads records, not git

When only the status directory has changed since the last full survey,
and that survey is younger than the backstop interval, `pipeline/survey`
answers with `refreshSurveyRuns(lastSurvey)`. That call reads the records
and re-attaches them to the directories the last survey listed, with no
git. Otherwise, it runs the full survey.

- **Rejected: a full survey on every record event.** A heartbeat every
  five seconds per run would mean a `git worktree list` every few seconds
  while anything runs.

### The view is told, not timed

`PipelineView` gains an optional `subscribe` prop:

- **With `subscribe`:** each reading happens when the view becomes
  active, on each signal that names that reading, and on the backstop
  interval.
- **Without `subscribe`:** nothing changes.

- **Rejected: pushing readings into the view as props.** It would add a
  second way for the component to receive data. It would also move the
  read-at time, and the handling of a reply that arrives after unmount,
  out of the component that already handles both correctly.

### Ages count between readings

`SurveyedRun` gains `activityAt` and `heartbeatAt`, the record's own
timestamps. `describeDirectoryRuns` takes an optional `now` and counts
the ages it states from those timestamps. While active, the view renders
again every five seconds with its clock.

- **Rejected: trusting the interval measured at read time.** With 60
  seconds between readings, "said this 12s ago" would stay on screen for
  a minute.

### Opening a change stays inside the host

The webview posts `openspec-ui/open-change` with a change name. The host
checks the name with `isValidChangeName`, then confirms that it is an
active change of its own workspace. Only then does it reveal the change in
the Changes tree, as `openspec-ui.revealInChanges` does, and open its
`proposal.md`.

- **Rejected: opening a path sent by the webview.** A bridge message must
  never say what gets read.

### The webview is not kept alive while hidden

The panel does not set `retainContextWhenHidden`. When the panel is
hidden, its watchers are disposed. When it is shown again, the webview
loads and reads afresh.

- **Rejected: retaining the context, as the AI panel does.** The AI panel
  holds a run's live transcript, which cannot be read again. The Pipeline
  holds nothing that cannot be read again.

## Protocol

No command or event is added or changed.

The bridge gains:

- two request operations, `pipeline/readiness` and `pipeline/survey`;
- two webview message types, `openspec-ui/pipeline-changed` (host to
  webview) and `openspec-ui/open-change` (webview to host).

These are host transport messages, like the existing request operations,
and the command and event protocol in core does not change. The standalone
server's routes keep their request and response shapes.

## Non-Goals

- Anything new on a card: its state word, its tasks, its controls.
- A push channel for the standalone shell.
- Showing the Pipeline in the local-server embed.
- Watching git refs to notice a branch switch before the backstop.

## Risks / Trade-offs

- **A reading can exceed the bridge's 10-second timeout.** On a large
  repository, `readChangeReadiness` runs a git diff per worktree. Task 7.2
  measures it on this repository. If it takes more than half the timeout,
  the pipeline operations get a timeout of their own.
- **The watcher may not fire outside the workspace.** A `RelativePattern`
  on a folder outside the workspace depends on VS Code's watcher support.
  If it does not fire, the backstop still re-reads within a minute. Task
  8.5 observes this in a real host.
- **A branch switch waits for the backstop.** It shows up to 60 seconds
  late. The read-at line says how old the picture is, as it already does.
- **A card still shows only what it shows today.** Until the next changes
  land, the editor gains the same partial picture that ADR 0029 describes
  in the standalone shell.

# The Pipeline opens in VS Code

## Why

ADR 0029 decides that the Pipeline is one tab, in both hosts, drawn by
one component. Today only the standalone shell renders `PipelineView`.
The extension has two webviews, the AI panel and the one-shot timeline,
and neither shows the Pipeline. Nothing in `packages/extension/src` calls
`readChangeReadiness` or `surveyWorktrees`. In the editor, a person sees
the Change Graph tree, which states relations. Nothing there says what is
running, what can start, or what the other working directories are
doing.

Two earlier changes already point here:

- `a-hint-says-what-can-run-together` recorded that the extension serves
  no readiness at all, and that giving it readiness is a capability of its
  own.
- `the-pipeline-shows-what-it-has-read` left the VS Code tab to its own
  ADR and changes.

This is that change. Two ADRs fix how it is built:

- ADR 0001: direct core calls and the message bridge, with no local
  server.
- ADR 0003: a webview is reserved for process visualization and controls
  that have no native equivalent, and the picture is exactly that.

## Capabilities

### New

- `OpenSpec UI: Open Pipeline`: a webview panel in the editor that renders
  the shared `PipelineView`. There is one such panel per window.
- Two bridge operations the panel reads through, `pipeline/readiness` and
  `pipeline/survey`. Each is answered by the same core call the standalone
  server makes.
- Re-reading on file events while the panel is visible:
  - a change under `openspec/changes` re-reads the picture;
  - a change in the status directory re-reads the runs' records, without
    running git;
  - a slow re-read covers what changes without a file event.
- The ages the picture states keep counting between readings.
- Opening a change from its card reveals it in the Changes tree and opens
  its `proposal.md`.

### Modified

- One core function assembles the readiness payload with its hints. Both
  the standalone server and the extension call it; the server's route no
  longer assembles the payload itself.
- `PipelineView` accepts a host's signal to re-read in place of its own
  clock, for hosts that have one. Without a signal it polls as it does
  today.

## Impact

- `packages/core`:
  - `readPipelineReadiness`, moved from `packages/server/src/rest.ts`.
  - `refreshSurveyRuns`, which re-attaches freshly read status records to
    a survey.
  - Timestamps on a surveyed run.
- `packages/server`: the readiness route calls the moved function. Its
  behaviour does not change.
- `packages/webui`: a pipeline webview entry, and the re-read signal on
  `PipelineView`.
- `packages/extension`: the panel, its command, its watchers, its bridge
  operations, and a fourth bundle in the build.

## Out of scope

- Anything a card says or does beyond what it says and does today. That
  starts with `a-card-says-what-its-change-is-doing`.
- Pushing readings to the standalone shell, which keeps polling (ADR
  0029).
- The local-server embed, which keeps hiding the Pipeline tab. That mode
  shows only the standalone shell's run surface.

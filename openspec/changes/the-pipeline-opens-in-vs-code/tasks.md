The Pipeline in the editor, from core's readings to a panel that re-reads
when files change (ADR 0029).

## 1. One readiness payload

- [ ] 1.1 A new `packages/core/src/pipeline-readings.ts` exports
  `readPipelineReadiness(workspaceRoot: string): Promise<ChangeReadinessReport>`.
  It returns `readChangeReadiness({ workspaceRoot })`. The report carries
  `hints` from `buildHints(report, { staleAfterMs: WORKSPACE_LEASE_STALE_AFTER_MS })`
  unless `resolveHarnessConfig(workspaceRoot)` sets `hints.enabled` to
  `false`. When hints are turned off, or the configuration cannot be read,
  the report has no `hints` key at all.

  Export `readPipelineReadiness` from `index.ts` only.
- [ ] 1.2 `handleChangeReadinessRequest` in `packages/server/src/rest.ts`
  answers with `readPipelineReadiness(parsed.cwd)`, and the private
  `hintsEnabled` function is removed. The server's existing readiness and
  hints tests pass without being changed.
- [ ] 1.3 core `pipeline-readings.test.ts` covers three configurations:
  - no `hints` setting: hints are present;
  - `hints.enabled: false`: no `hints` key;
  - a malformed configuration: no `hints` key.

## 2. Records re-read without git

- [ ] 2.1 A pure function `attachRunsToDirectories(directories, reports)`
  in `packages/core/src/worktree-survey.ts` does the matching that
  `surveyWorktrees` does today by `pathKey(report.workingDirectory)`. That
  includes the runs it reports in `runsElsewhere`. `surveyWorktrees` calls
  the new function instead of matching inline.
- [ ] 2.2 `refreshSurveyRuns(survey: WorktreeSurvey, options): Promise<WorktreeSurvey>`,
  in the same file:
  - resolves the status directory from the survey's main directory, with
    `resolveWorktreeRoot` and `agentStatusDirectory`, as `surveyWorktrees`
    does;
  - reads the records with `readAgentStatuses`;
  - re-attaches them with `attachRunsToDirectories`.

  It runs no git. Its test passes a `git` seam that throws on any call.
- [ ] 2.3 `SurveyedRun` in `packages/core/src/worktree-survey-facts.ts`
  gains `activityAt` and `heartbeatAt`, the record's own timestamps.
  `toRun` fills them.
- [ ] 2.4 `describeDirectoryRuns(directory, now?: Date)` in
  `packages/core/src/worktree-survey-facts.ts` counts each age it states
  from `activityAt` and `heartbeatAt` when `now` is given. When `now` is
  not given, it uses the intervals measured at read time, as it does
  today.
- [ ] 2.5 core `worktree-survey.test.ts`:
  - `refreshSurveyRuns` moves a run to the directory its new record names;
  - it drops a record that is gone from disk;
  - it reports a record whose directory is not a working directory in
    `runsElsewhere`.

## 3. PipelineView re-reads on a host's signal

- [ ] 3.1 `PipelineViewProps` in
  `packages/webui/src/components/PipelineView.tsx` gains
  `subscribe?: (listener: (reading: "readiness" | "survey") => void) => () => void`.
  - **With it:** `usePolledReading` reads when the view becomes active, on
    each signal naming its reading, and every
    `PIPELINE_BACKSTOP_INTERVAL_MS` (60 000) while active.
  - **Without it:** it reads every `PIPELINE_POLL_INTERVAL_MS` and
    `SURVEY_POLL_INTERVAL_MS`, as today.

  The unsubscribe function runs on deactivation and on unmount.
- [ ] 3.2 While active, the view renders again every 5 seconds and passes
  its clock to `describeDirectoryRuns`, so the ages it shows keep
  counting. These renders read nothing.
- [ ] 3.3 webui `PipelineView.test.tsx`:
  - with `subscribe`, a `survey` signal calls `survey` once and does not
    call `load`;
  - no reading happens between signals before the backstop interval;
  - without `subscribe`, the existing polling tests pass unchanged;
  - a stated age grows between two renders with no new reading.

## 4. The panel

- [ ] 4.1 `packages/webui/src/pipeline-entry.tsx` renders `PipelineView`
  inside `.openspec-extension-app`, after `shellThemeCss` and then
  `vscodeThemeCss`, as `timeline-entry.tsx` does.
  - `load` and `survey` are stable callbacks that send
    `pipeline/readiness` and `pipeline/survey` through
    `createBridgeRequester`.
  - `subscribe` listens for `openspec-ui/pipeline-changed` messages.
  - `onOpenChange` posts `openspec-ui/open-change`.
- [ ] 4.2 `BridgeOperation` in `packages/webui/src/bridge-request.ts` gains
  `pipeline/readiness` and `pipeline/survey`. The pipeline panel's handler
  declares the same two operations. Do not add them to the AI panel's
  `RequestOperation`, which serves another panel.
- [ ] 4.3 `pipelineWebviewBuildOptions` in
  `packages/extension/scripts/build-options.mjs` bundles
  `pipeline-entry.tsx` to `dist/pipeline.js`, and
  `packages/extension/scripts/build.mjs` builds it. Record the bundle's
  size. `.vscodeignore` already ships `dist/`; check that it still does,
  and do not change it.
- [ ] 4.4 A new `PipelinePanel` in
  `packages/extension/src/webview/pipeline-panel.ts` opens one
  `openspecUiPipeline` webview panel per window, and reveals it when it is
  already open. The panel:
  - is titled `OpenSpec UI: Pipeline`;
  - has scripts enabled;
  - limits resources to `dist`;
  - does not set `retainContextWhenHidden`;
  - uses the content security policy
    `default-src 'none'; script-src <cspSource>; style-src <cspSource> 'unsafe-inline';`.
- [ ] 4.5 The panel answers the two operations:
  - `pipeline/readiness` with `readPipelineReadiness(workspaceRoot)`.
  - `pipeline/survey` with
    `surveyWorktrees({ workspaceRoot, sweepStatuses: true })`. When only
    the status directory has changed since the last full survey, and that
    survey is younger than the backstop interval, it answers with
    `refreshSurveyRuns` of that survey instead.

  The workspace root is the host's own, and no message names a path. An
  unknown operation is refused with an error reply, as `answerRequest` in
  `ai-panel.ts` refuses one.
- [ ] 4.6 `openspec-ui.openPipeline`, titled `OpenSpec UI: Open Pipeline`,
  is contributed in `packages/extension/package.json`, registered in
  `packages/extension/src/extension.ts`, and offered in the Changes view's
  title bar.

## 5. Re-reading on file events

- [ ] 5.1 While the panel is visible, the host watches two things:
  - `openspec/changes/**` under the workspace root. A change posts
    `openspec-ui/pipeline-changed` naming both readings.
  - `*.json` in the directory `resolveAgentStatusDirectory` returns. A
    change posts `openspec-ui/pipeline-changed` naming the survey only,
    and records that only the records changed.

  Events within 1 second of each other become one message. The watchers
  are disposed when the panel is hidden or closed.
- [ ] 5.2 When the status directory cannot be resolved, the panel relies on
  the backstop interval alone. The survey's `runsUnreadable` says why, as
  it already does.
- [ ] 5.3 extension `pipeline-panel.test.ts`:
  - two `openspec/changes` events within a second post one message naming
    both readings;
  - a status directory event posts one message naming the survey;
  - after the watchers are disposed, no message is posted.

## 6. Opening a change

- [ ] 6.1 On `openspec-ui/open-change`, the panel does the following, in
  order:
  1. Checks the name with `isValidChangeName`.
  2. Checks, with `discoverOpenSpecWorkspace`, that the name is an active
     change of its workspace.
  3. Reveals the change in the Changes tree, as
     `openspec-ui.revealInChanges` does: builds a `ChangeTreeItem` from
     the discovered change and calls the tree's `reveal`.
  4. Opens the change's `proposal.md`.

  For a name that fails either check, it shows an information message
  and opens nothing.
- [ ] 6.2 extension `pipeline-panel.test.ts`:
  - an active change is revealed and opened;
  - an unknown name opens nothing and says so;
  - a name containing a path separator is refused before any lookup.

## 7. Tests and measurements

- [ ] 7.1 The extension integration suite in
  `packages/extension/src/test-suite/`: `openspec-ui.openPipeline` opens a
  webview panel titled `OpenSpec UI: Pipeline`, and running it twice
  leaves one panel.
- [ ] 7.2 Measure `readPipelineReadiness` and `surveyWorktrees` over this
  repository: five runs each, after a warm-up. Record the times beside
  `BRIDGE_REQUEST_TIMEOUT_MS`. If either takes more than half that
  timeout, give the pipeline operations a timeout of their own, stated
  with the measurement.

## 8. Verification

- [ ] 8.1 This change validates strictly. `check(validate-change)`
- [ ] 8.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and the test count for each package.
- [ ] 8.3 A pending changeset exists: core, webui and the extension minor,
  server patch. `check(changeset-present)`
- [ ] 8.4 Run the whole browser suite, not a selected spec. The standalone
  Pipeline's specs pass unchanged.
- [ ] 8.5 **Delegated to claude-cli**: check the panel in a real VS Code
  host.

  Setup: an Extension Development Host built from this branch, opened on
  a scratch copy of a repository that has two active changes and one
  extra worktree.

  Steps:
  1. Run `OpenSpec UI: Open Pipeline`.
  2. Record the panel's read-at line.
  3. Create a third change directory under `openspec/changes` and record
     the time.
  4. Record the read-at line again, and how long it took to change.
  5. With a run reporting in the worktree, record how long its activity
     took to appear.

  Evidence:
  - the read-at line before and after step 3, and the time between;
  - how long the worktree run's activity took to appear;
  - a picture of the panel, taken the way
    `an-editor-picture-is-taken-too` takes editor pictures, and looked at;
  - the extension host's log for the session.

  Unit tests cannot show whether VS Code's watcher fires for the status
  directory, which lies outside the workspace.

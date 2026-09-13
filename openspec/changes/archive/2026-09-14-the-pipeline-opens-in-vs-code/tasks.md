The Pipeline in the editor, from core's readings to a panel that re-reads
when files change (ADR 0029).

## 1. One readiness payload

- [x] 1.1 A new `packages/core/src/pipeline-readings.ts` exports
  `readPipelineReadiness(workspaceRoot: string): Promise<ChangeReadinessReport>`.
  It returns `readChangeReadiness({ workspaceRoot })`. The report carries
  `hints` from `buildHints(report, { staleAfterMs: WORKSPACE_LEASE_STALE_AFTER_MS })`
  unless `resolveHarnessConfig(workspaceRoot)` sets `hints.enabled` to
  `false`. When hints are turned off, or the configuration cannot be read,
  the report has no `hints` key at all.

  Export `readPipelineReadiness` from `index.ts` only.
- [x] 1.2 `handleChangeReadinessRequest` in `packages/server/src/rest.ts`
  answers with `readPipelineReadiness(parsed.cwd)`, and the private
  `hintsEnabled` function is removed. The server's existing readiness and
  hints tests pass without being changed.
  Done: server suite 86 passed with `server.test.ts` untouched, 2026-09-13.
- [x] 1.3 core `pipeline-readings.test.ts` covers three configurations:
  - no `hints` setting: hints are present;
  - `hints.enabled: false`: no `hints` key;
  - a malformed configuration: no `hints` key.

## 2. Records re-read without git

- [x] 2.1 A pure function `attachRunsToDirectories(directories, reports)`
  in `packages/core/src/worktree-survey.ts` does the matching that
  `surveyWorktrees` does today by `pathKey(report.workingDirectory)`. That
  includes the runs it reports in `runsElsewhere`. `surveyWorktrees` calls
  the new function instead of matching inline.
- [x] 2.2 `refreshSurveyRuns(survey: WorktreeSurvey, options): Promise<WorktreeSurvey>`,
  in the same file:
  - resolves the status directory from the survey's main directory, with
    `resolveWorktreeRoot` and `agentStatusDirectory`, as `surveyWorktrees`
    does;
  - reads the records with `readAgentStatuses`;
  - re-attaches them with `attachRunsToDirectories`.

  It runs no git. Its test passes a `git` seam that throws on any call.
  Done: both share one private `readStatusReports`; the refresh keeps the
  survey's directories, changes and `thisAuthor`, and replaces
  `runsUnreadable` with this reading's.
- [x] 2.3 `SurveyedRun` in `packages/core/src/worktree-survey-facts.ts`
  gains `activityAt` and `heartbeatAt`, the record's own timestamps.
  `toRun` fills them.
  Done: `AgentStatusReport` carries the two timestamps too, which is where
  `toRun` reads them from.
- [x] 2.4 `describeDirectoryRuns(directory, now?: Date)` in
  `packages/core/src/worktree-survey-facts.ts` counts each age it states
  from `activityAt` and `heartbeatAt` when `now` is given. When `now` is
  not given, it uses the intervals measured at read time, as it does
  today.
  Done, and `describeRun(run, now?)` the same; a timestamp that does not
  parse falls back to the measured interval.
- [x] 2.5 core `worktree-survey.test.ts`:
  - `refreshSurveyRuns` moves a run to the directory its new record names;
  - it drops a record that is gone from disk;
  - it reports a record whose directory is not a working directory in
    `runsElsewhere`.
  Done: 17 tests pass, 2026-09-13, with three more for 2.4.

## 3. PipelineView re-reads on a host's signal

- [x] 3.1 `PipelineViewProps` in
  `packages/webui/src/components/PipelineView.tsx` gains
  `subscribe?: (listener: (reading: "readiness" | "survey") => void) => () => void`.
  - **With it:** `usePolledReading` reads when the view becomes active, on
    each signal naming its reading, and every
    `PIPELINE_BACKSTOP_INTERVAL_MS` (60 000) while active.
  - **Without it:** it reads every `PIPELINE_POLL_INTERVAL_MS` and
    `SURVEY_POLL_INTERVAL_MS`, as today.

  The unsubscribe function runs on deactivation and on unmount.
- [x] 3.2 While active, the view renders again every 5 seconds and passes
  its clock to `describeDirectoryRuns`, so the ages it shows keep
  counting. These renders read nothing.
  Done: `PIPELINE_CLOCK_INTERVAL_MS`; the clock also reaches `describeRun`
  for runs reported from no working directory.
- [x] 3.3 webui `PipelineView.test.tsx`:
  - with `subscribe`, a `survey` signal calls `survey` once and does not
    call `load`;
  - no reading happens between signals before the backstop interval;
  - without `subscribe`, the existing polling tests pass unchanged;
  - a stated age grows between two renders with no new reading.
  Done: 27 tests pass, 2026-09-13. The shared `run()` fixture now derives
  its timestamps from the intervals it is given, which a gone run's test
  needed once the view counted from them.

## 4. The panel

- [x] 4.1 `packages/webui/src/pipeline-entry.tsx` renders `PipelineView`
  inside `.openspec-extension-app`, after `shellThemeCss` and then
  `vscodeThemeCss`, as `timeline-entry.tsx` does.
  - `load` and `survey` are stable callbacks that send
    `pipeline/readiness` and `pipeline/survey` through
    `createBridgeRequester`.
  - `subscribe` listens for `openspec-ui/pipeline-changed` messages.
  - `onOpenChange` posts `openspec-ui/open-change`.
- [x] 4.2 `BridgeOperation` in `packages/webui/src/bridge-request.ts` gains
  `pipeline/readiness` and `pipeline/survey`. The pipeline panel's handler
  declares the same two operations. Do not add them to the AI panel's
  `RequestOperation`, which serves another panel.
- [x] 4.3 `pipelineWebviewBuildOptions` in
  `packages/extension/scripts/build-options.mjs` bundles
  `pipeline-entry.tsx` to `dist/pipeline.js`, and
  `packages/extension/scripts/build.mjs` builds it. Record the bundle's
  size. `.vscodeignore` already ships `dist/`; check that it still does,
  and do not change it.
  Done 2026-09-13: `dist/pipeline.js` 1.1 MB, its map 1.8 MB.
  `.vscodeignore` excludes `dist/test-suite/**` only, so the bundle ships.
  `src/test/run.mjs` builds it too, for the integration suite.
- [x] 4.4 A new `PipelinePanel` in
  `packages/extension/src/webview/pipeline-panel.ts` opens one
  `openspecUiPipeline` webview panel per window, and reveals it when it is
  already open. The panel:
  - is titled `OpenSpec UI: Pipeline`;
  - has scripts enabled;
  - limits resources to `dist`;
  - does not set `retainContextWhenHidden`;
  - uses the content security policy
    `default-src 'none'; script-src <cspSource>; style-src <cspSource> 'unsafe-inline';`.
- [x] 4.5 The panel answers the two operations:
  - `pipeline/readiness` with `readPipelineReadiness(workspaceRoot)`.
  - `pipeline/survey` with
    `surveyWorktrees({ workspaceRoot, sweepStatuses: true })`. When only
    the status directory has changed since the last full survey, and that
    survey is younger than the backstop interval, it answers with
    `refreshSurveyRuns` of that survey instead.

  The workspace root is the host's own, and no message names a path. An
  unknown operation is refused with an error reply, as `answerRequest` in
  `ai-panel.ts` refuses one.
- [x] 4.6 `openspec-ui.openPipeline`, titled `OpenSpec UI: Open Pipeline`,
  is contributed in `packages/extension/package.json`, registered in
  `packages/extension/src/extension.ts`, and offered in the Changes view's
  title bar.

## 5. Re-reading on file events

- [x] 5.1 While the panel is visible, the host watches two things:
  - `openspec/changes/**` under the workspace root. A change posts
    `openspec-ui/pipeline-changed` naming both readings.
  - `*.json` in the directory `resolveAgentStatusDirectory` returns. A
    change posts `openspec-ui/pipeline-changed` naming the survey only,
    and records that only the records changed.

  Events within 1 second of each other become one message. The watchers
  are disposed when the panel is hidden or closed.
  Done: the window opens at the first event and every event inside it
  joins the one message, so a record rewritten once a second cannot hold
  the message back indefinitely.
- [x] 5.2 When the status directory cannot be resolved, the panel relies on
  the backstop interval alone. The survey's `runsUnreadable` says why, as
  it already does.
- [x] 5.3 extension `pipeline-panel.test.ts`:
  - two `openspec/changes` events within a second post one message naming
    both readings;
  - a status directory event posts one message naming the survey;
  - after the watchers are disposed, no message is posted.
  Done: 12 tests pass, 2026-09-13.

## 6. Opening a change

- [x] 6.1 On `openspec-ui/open-change`, the panel does the following, in
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
- [x] 6.2 extension `pipeline-panel.test.ts`:
  - an active change is revealed and opened;
  - an unknown name opens nothing and says so;
  - a name containing a path separator is refused before any lookup.

## 7. Tests and measurements

- [x] 7.1 The extension integration suite in
  `packages/extension/src/test-suite/`: `openspec-ui.openPipeline` opens a
  webview panel titled `OpenSpec UI: Pipeline`, and running it twice
  leaves one panel.
  Done in `src/test/suite/extension.test.ts`, counted from the editor's own
  tabs. Run 2026-09-13 with the inherited `VSCODE_*` and `ELECTRON_*`
  variables stripped: 18 passing. The first run had 17 passing and one
  failure in `Run with Harness renders the panel and applies a named
  configuration`, which waited a fixed 250 ms for an asynchronous write and
  read the old file while the browser suite loaded the machine; it now
  waits for the file, and passed in the second run under the same load.
- [x] 7.2 Measure `readPipelineReadiness` and `surveyWorktrees` over this
  repository: five runs each, after a warm-up. Record the times beside
  `BRIDGE_REQUEST_TIMEOUT_MS`. If either takes more than half that
  timeout, give the pipeline operations a timeout of their own, stated
  with the measurement.
  Done 2026-09-13, this repository with 9 active changes, from the TS
  sources through `tsx`: `readPipelineReadiness` 386, 421, 387, 393,
  386 ms; `surveyWorktrees` (with `sweepStatuses`) 1098, 1670, 1945, 1884,
  1809 ms. `BRIDGE_REQUEST_TIMEOUT_MS` is 10 000 ms; the slowest reading
  is under a fifth of it, so the pipeline operations keep the shared
  timeout.

## 8. Verification

- [x] 8.1 This change validates strictly. `check(validate-change)`
  Done: `openspec validate the-pipeline-opens-in-vs-code --strict` reports
  it valid, 2026-09-13.
- [x] 8.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and the test count for each package.
  Local run 2026-09-13, exit code 1. Typecheck and every lint passed.
  Tests: cli 134 passed; core 1245 passed, 1 failed; extension 351 passed;
  server 86 passed; webui 430 passed. The one failure is `keeps accepting
  this repository's real openspec/agent-harness.json`, which reads the
  working tree's file: an uncommitted local edit, not part of this change,
  sets its `autonomyLevel` to `semi-autonomous`.
  Closed on the same checks run against the committed tree: CI job
  "Typecheck, lint, test, and build" on `fba96d2` (#478) succeeded,
  [run 34776242009](https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/34776242009/job/103774771025),
  as `a-change-is-configured-from-the-change` 8.2 was.
- [x] 8.3 A pending changeset exists: core, webui and the extension minor,
  server patch. `check(changeset-present)`
  Done: `.changeset/the-pipeline-opens-in-vs-code.md`.
- [x] 8.4 Run the whole browser suite, not a selected spec. The standalone
  Pipeline's specs pass unchanged.
  Done 2026-09-13: `npm run test:browser` in `packages/server`, 18 passed
  (6.3 min), `pipeline.spec.ts` unchanged. The pictures it retook of
  screens this change does not touch were left as they were.
- [x] 8.5 **Delegated to claude-cli**: check the panel in a real VS Code
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

  Done 2026-09-13, recorded in `evidence/8.5/`.

  Setup:
  - VS Code 1.136.1, the build `.vscode-test` holds, launched through
    Playwright's Electron driver as `e2e/editor-screenshots.spec.ts`
    launches it, with `--extensionDevelopmentPath` pointing at
    `packages/extension`. The inherited `VSCODE_*` and `ELECTRON_*`
    variables were removed from its environment.
  - The bundles were rebuilt from this branch at `fba96d2` with
    `npm run build`.
  - The workspace was a scratch git repository made from
    `create-picture-workspace.ts`, with two active changes, and one extra
    worktree, `extra-work`. It was put under the gitignored `.vscode-test`
    so no path on screen carries the account name, and
    `OPENSPEC_UI_WORKTREE_ROOT` pointed at its own `.worktrees`.
  - The run reporting in the worktree was core's own `AgentStatusWriter`,
    writing to the resolved status directory. That directory did not exist
    when the panel opened.

  Numbers below are from the fourth run, whose full timeline is
  `evidence/8.5/timeline.log`:
  1. `OpenSpec UI: Open Pipeline` activated the extension
     (`activationEvent: 'onCommand:openspec-ui.openPipeline'`) and opened
     one tab, `OpenSpec UI: Pipeline`. The first full picture was drawn
     2.6 s after the command.
  2. Read-at before: `Last read 10:15:19 PM; other working directories
     10:15:20 PM.`
  3. `openspec/changes/a-third-change` was created at 22:15:24.486, 6.7 s
     after the command, far from the 60 s backstop.
  4. Read-at after: `Last read 10:15:26 PM; other working directories
     10:15:20 PM.` It changed 2.5 s after the directory was created, and
     the `a-third-change` card appeared after 2.6 s. The survey followed at
     10:15:27.
  5. The worktree run's first activity, `Reading the proposal`, appeared
     after 6.3 s. The status directory had been created after watching
     began. A rewritten activity then appeared after 1.5 s. After the panel
     was closed and opened again, with the command run twice and still one
     tab, a rewritten activity appeared after 1.5 s.
     - Each 5 s heartbeat moved only the time for the other working
       directories. `Last read` stayed at 10:15:50 PM for 30 s, so a record
       event re-reads the survey alone.
     - Between readings the stated age counted `said 0s ago`, then 5s, 10s,
       15s, 20s.

  Answer to the open question: VS Code's watcher does fire for the status
  directory outside the workspace, both where the directory existed when
  watching began and where it was created later.

  Observation, not a failure: the first record in a status directory
  created after watching began took 6.3 s to appear, against 1.2 to 1.5 s
  for later records. That is consistent with the directory's first write
  going unseen and the next heartbeat being caught.

  The runs agree:
  - Run 2: 1.2 s for the new change; 6.4 s and 1.3 s for the worktree run.
  - Run 3: 1.3 s for the new change; 6.3 s, 1.2 s and 0.6 s for the
    worktree run.

  Runs 1 and 2 stopped at the reopen step. The check script's F1 went into
  the webview's frame, a defect in the script and not in the extension.

  Pictures, both looked at:
  - `evidence/8.5/pipeline-panel.png`: three READY cards, including
    `a-third-change`, and three hints.
  - `evidence/8.5/pipeline-panel-other-directories.png`: `extra-work` on
    branch `extra-work` with `a-change-not-started: Running the tests —
    said 20s ago`, its two foreign cards, and the read-at line.

  Log: `evidence/8.5/exthost.log`, 53 lines, with no error. Its warnings:
  - two `vscode.git` configuration warnings;
  - one `navigator` deprecation warning from the ACP SDK's zod schema,
    raised while `dist/extension.js` loads.

  The host exited with code 0. The `OpenSpec UI` output channel was empty.

  Checked 2026-09-13 by a second agent against the evidence, not the run's
  own account:
  - Every number above for run 4 matches `evidence/8.5/timeline.log`
    (read-at changed 2523 ms, card 2578 ms; activity 6318, 1512 and
    1465 ms; one tab after the command ran twice; `Last read 10:15:50 PM`
    unchanged through the heartbeats while the other directories' time
    moved).
  - Both pictures show what is described, and neither carries the account
    name.
  - `exthost.log` is 53 lines, with the activation event, the three
    warnings and the exit code as stated.
  - The figures quoted for runs 2 and 3 have no timeline of their own in
    `evidence/8.5/`; only run 4 is evidenced.

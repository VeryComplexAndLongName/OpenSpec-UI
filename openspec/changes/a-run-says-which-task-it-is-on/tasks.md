What a run says about its task and its wait, from the instruction to
every surface that shows it (ADR 0029).

## 1. The instruction

- [ ] 1.1 `commandInstruction("implement")` in
  `packages/core/src/agents/shared.ts` tells the agent to print, before it
  starts work on a task, a line of its own reading
  `Starting task <number>`, using the task's number from `tasks.md`. It
  gives `Starting task 2.3` as the example. The instructions for `plan`,
  `review` and `verify` do not mention the line.
- [ ] 1.2 `packages/core/src/agents/shared.test.ts` pins `Starting task` in
  the implement instruction, and pins its absence from the plan, review
  and verify instructions.

## 2. Reading a marker

- [ ] 2.1 A new file, `packages/core/src/task-marker.ts`, exports a pure
  function `readTaskMarker(line: string): string | undefined` that returns
  the number of a marker line. It reads a line as follows:
  1. Trim the line.
  2. Remove any leading `>`, `#`, `-` or `*` marks, and any surrounding
     `**`, `__` or single backticks.
  3. What remains must begin with the words `Starting task` and a space,
     followed by a number made of digits separated by single dots (the
     form `taskNumberOf` accepts).
  4. After the number, the line must end, end with a full stop, or
     continue after a colon.

  The phrase is accepted only at the start of a line. Do not accept it
  anywhere else: `I am starting task 2.3` and `Starting task 2.3 now` both
  return `undefined`.
- [ ] 2.2 `packages/core/src/task-marker.test.ts` covers:
  - a plain marker;
  - a marker in bold;
  - a marker in backticks;
  - a marker after a quote mark (`>`);
  - a marker with a title after a colon;
  - a marker ending in a full stop;
  - the phrase inside a sentence;
  - a number with a letter in it;
  - no number at all.
- [ ] 2.3 `readAcpStreamedText` in `packages/core/src/acp-streamed-text.ts`
  says whether its text is the agent's reply (`agent_message_chunk`) or
  its reasoning (`agent_thought_chunk`). Every existing caller keeps
  treating both as streamed text. Record which callers were checked.
- [ ] 2.4 `OpenLines` in `packages/core/src/agent-status.ts` keeps
  `stdout`, `reply` and `reasoning` apart, so a reasoning chunk never
  completes a line that a reply began. `takeOpenLines` takes the
  unfinished reply line first, then reasoning, then stdout.
- [ ] 2.5 `takeCompleteLine` returns every completed non-empty line of a
  chunk, not only the last; the activity is still the last of those lines.
  `applyEventToAgentStatus` passes each completed line of `stdout` and of
  reply text to `readTaskMarker`. It never passes a reasoning line or a
  `describeAcpUpdate` line to it.

## 3. The record

- [ ] 3.1 `AgentStatusDocument` keeps `version: 1` and gains three fields:
  - `runId: string | null`
  - `task: { number: string; source: "agent" | "command"; since: string } | null`
  - `waiting: { kind: "checkpoint"; stage: string; nextStage: string } | { kind: "permission"; description: string } | null`

  `AgentStatusReport` carries the same three fields.
- [ ] 3.2 `AgentStatusWriter.reportTask(number, source)` and
  `AgentStatusWriter.reportWaiting(waiting)` each write immediately, through
  the writer's queue, and never through the once-a-second limit of
  `noteStreamedActivity`. Later writes keep both fields.
- [ ] 3.3 A marker line sets the task with source `agent`, and a later
  marker replaces it. When a command carries `taskNumber`, its record holds
  that number with source `command` from the first write, and no marker
  replaces it.
- [ ] 3.4 Waiting follows the run's events:
  - `checkpoint` sets `waiting` to
    `{ kind: "checkpoint", stage, nextStage }` and sets the activity to
    `waiting to continue to <nextStage>`.
  - `permissionRequest` sets `waiting` to
    `{ kind: "permission", description }`.
  - The next event of any other kind sets `waiting` back to `null`.
- [ ] 3.5 `withAgentStatus` takes
  `Pick<Command, "kind" | "cwd" | "context" | "runId" | "taskNumber">`, and
  `startAgentStatusWriter` records `runId` and `taskNumber` in the first
  write.

  Junctions: every call site must pass the command it runs, not an object
  built without these two fields. Record each of the six call sites as
  checked:
  - `packages/server/src/websocket.ts` (three calls)
  - `packages/cli/src/run-change.ts`
  - `packages/extension/src/run-controller.ts`
  - `packages/core/src/delegated-item-run.ts`
- [ ] 3.6 `readAgentStatusRecord` reads the three fields when they are
  well-formed, and reads a missing or malformed one as `null`. A record is
  not called malformed on that account.

## 4. The record paired with the task list

- [ ] 4.1 `packages/core/src/task-marker.ts` exports
  `taskInHand(task: AgentStatusDocument["task"], items: readonly TaskChecklistItem[]): { number: string; text: string; source: "agent" | "command" } | undefined`.
  It returns the item whose `taskNumberOf(item.text)` equals the task's
  number. It returns `undefined` for a `null` task, and for a number that
  no item carries. Export it from `index.ts`.
- [ ] 4.2 `SurveyedRun` in `packages/core/src/worktree-survey-facts.ts`
  gains `runId`, `waiting` and `task`.
  - `task` is the result of `taskInHand` against the task list of the
    run's own change in the run's own directory, or absent.
  - `surveyWorktrees` keeps the items it already reads for each change,
    so it can pair them with the runs in that directory.
  - A run whose change the survey did not read gets no `task`.
- [ ] 4.3 `describeRun`, which `describeDirectoryRuns` in
  `packages/core/src/worktree-survey-facts.ts` uses:
  - adds `on task 1.2: <text>, by its own account` or
    `on task 6.5: <text>, the task it was given`;
  - for a waiting run, says `waiting to continue to <nextStage>` or
    `waiting for a permission: <description>` instead of the stage.
- [ ] 4.4 `openspec-ui-cli status` in `packages/cli/src/status-command.ts`
  prints the same task and wait lines beneath a run's activity.
  - It reads the change's list with
    `readTaskChecklist(report.workingDirectory, report.changeName)`,
    best-effort. When the list cannot be read, it prints no task line.
  - Its `--json` output carries `runId`, `task` and `waiting` exactly as
    the record holds them.

## 5. Tests

- [ ] 5.1 core `agent-status.test.ts`: a `stdout` chunk holding the line
  `Starting task 1.2` and then the line `reading the file` records task
  1.2 by the agent's own account, with the activity `reading the file`.
- [ ] 5.2 core `agent-status.test.ts`:
  - one ACP reply message holding the marker and then two more lines
    records the task;
  - a reasoning chunk holding a marker records no task;
  - a record started for `taskNumber` `6.5` still says 6.5 after a marker
    naming 1.1.
- [ ] 5.3 core `agent-status.test.ts`:
  - a `checkpoint` makes the record waiting, with its stages;
  - the next `stageStarted` clears the wait;
  - a `permissionRequest` makes the record waiting, with its description;
  - each of these is on disk before the next event is applied.
- [ ] 5.4 core `agent-status.test.ts`:
  - the record carries the command's `runId`;
  - a record file written without the three fields reads with all three
    `null`, and is not malformed;
  - a record whose `task` is the number `5` reads with `task` `null`, and
    is not malformed.
- [ ] 5.5 core `worktree-survey.test.ts`:
  - a record naming task 1.2, for a change whose list has 1.2, is surveyed
    with that task's text and source;
  - a record naming 9.9 is surveyed with no task.
- [ ] 5.6 cli `status-command.test.ts`: the task line, both wait lines, and
  no task line for a number the list does not have.
- [ ] 5.7 webui `PipelineView.test.tsx`: a directory's run lines name the
  task in hand, and say that a waiting run is waiting.

## 6. Verification

- [ ] 6.1 This change validates strictly. `check(validate-change)`
- [ ] 6.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and the test count for each package.
- [ ] 6.3 A pending changeset exists: core and cli minor, webui patch.
  `check(changeset-present)`
- [ ] 6.4 Run the whole browser suite, not a selected spec, and record the
  run.
- [ ] 6.5 **Delegated to claude-cli**: find out which agents deliver a
  marker while they work.

  Setup:
  - A scratch git repository outside this one, holding a change with
    three small tasks.
  - `openspec/agent-harness.json` puts `apply` on `claude-cli-acp`.
  - A per-change `harness.json` sets `autonomyLevel` to `autonomous`, so
    no checkpoint waits on the terminal.
  - Run `npm run build -w @openspec-ui/cli` first.

  Steps:
  1. Run the change with this branch's `openspec-ui-cli run`.
  2. Read `openspec-ui-cli status` every five seconds until the run ends.
  3. Repeat both steps with `apply` on `claude-cli`.

  Evidence, for each agent: the run id and its `started` audit line, and
  every distinct `on task` line that `status` printed, with its time. If
  none appeared before the run ended, record that.

  The unit tests feed recorded chunks; only a real run shows when each
  agent's reply arrives.

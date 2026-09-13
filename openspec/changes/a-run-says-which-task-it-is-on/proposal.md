# A run says which task it is on, and when it is waiting

## Why

ADR 0029 decides that a change's card names the task its run is on and
says when the run is waiting rather than working. Nothing can read either
today.

- **No code names the task a run is on.** The status record ADR 0028 gave
  every run, `AgentStatusDocument` in `packages/core/src/agent-status.ts`,
  carries an activity, a stage and a change, and says nothing about
  tasks. A delegated run is started for one task, as `command.taskNumber`,
  and the audit log records that number. `withAgentStatus` never writes it
  to the record.
- **The activity line cannot carry a task.** `applyEventToAgentStatus`
  keeps only the last completed line of each chunk of output, and within a
  second the next line replaces it. Claude-cli-acp delivers each message
  whole, so a line naming a task that is followed by more text in the same
  message is dropped today.
- **A chain waiting at a checkpoint says it is running.** No event case
  handles `checkpoint` or `permissionRequest`. While the chain waits on a
  person, the record keeps saying "running apply" and the heartbeat
  continues, which is exactly how ADR 0028 describes a hung agent.
- **No record is tied to the run a host knows.** A record's `instanceId`
  belongs to the record. The `runId` a host uses to cancel or answer a run
  does not appear in it.

## Capabilities

### New

- The implementing instruction asks the agent to print
  `Starting task <number>` on a line of its own before it starts a task.
- A run's status record carries:
  - the task the run is on, either by the agent's own account or, for a
    delegated run, from the command;
  - whether the run is waiting at a checkpoint or on a permission;
  - its run id.
- A core reader pairs a record's task with the change's task list, and
  drops a number the list does not have.

### Modified

- The survey's runs and `openspec-ui-cli status` show the task in hand and
  the wait.
- The record's reading of streamed text separates the agent's reply from
  its reasoning, so that only the reply can name a task.

## Impact

- `packages/core`:
  - `agents/shared.ts`: the instruction.
  - `agent-status.ts`: the record, the reader, the event mapping and
    `withAgentStatus`.
  - `acp-streamed-text.ts`: which kind of text was streamed.
  - `worktree-survey.ts` and its facts.
- `packages/cli`: `status-command.ts`.
- `packages/webui`: the run lines `PipelineView` shows under a directory.
- No new event kind and no change to commands. The record is already how
  every surface learns what a run is doing (ADR 0029).

## Out of scope

- Guessing the task in hand when no marker came, and everything else a
  card says. Both belong to `a-card-says-what-its-change-is-doing`.
- Answering a checkpoint from anywhere other than where the run was
  started.

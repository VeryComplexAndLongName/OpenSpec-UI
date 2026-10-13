## MODIFIED Requirements

### Requirement: Every run keeps a log

When a host hands its runners the workspace's run logs, `packages/core`
SHALL write each run's log to `.openspec-ui/runs/<runId>.jsonl`. The log
SHALL hold, for every stage the run id is given:

- a start record naming the agent, the kind, the working directory, the
  change, the stage and the task where there is one;
- a line for each event that says something, read the way the hosts read
  it;
- an end record with the outcome, reason and summary.

A run the sandbox or the allowlist refused SHALL get a log whose end says
it was refused and why.

A log SHALL stop at a size cap and say where it stopped, and its end SHALL
still be written. The directory SHALL keep only the newest logs. Writing a
log SHALL NOT delay or fail a run.

Core SHALL list a workspace's logged runs, newest first, and one change's
when asked, without reading each log whole. It SHALL read one run's log by
its id, and SHALL refuse an id that could name a file outside the
directory.

Core SHALL resolve where one change's logs are read from: the change's own
worktree, found from the change's name and the repository's worktree list,
where it has one, and the host's own root where it has none. A request SHALL
name the change and SHALL NOT name a path.

#### Scenario: A run completes

- **WHEN** a run writes to stdout and completes
- **THEN** its log holds its start, what it wrote, and an end that says it
  completed

#### Scenario: A chain runs two stages

- **WHEN** a chain's `propose` and `apply` stages run under one run id
- **THEN** one log holds both, each with its own start and end
- **AND** the list names both stages for that run

#### Scenario: The allowlist refuses a run

- **WHEN** the allowlist refuses a run's invocation
- **THEN** the run's log ends as refused, with the reason

#### Scenario: A run says too much

- **WHEN** a run's output passes the cap
- **THEN** the log says it stopped there, and still ends with the outcome

#### Scenario: A request names a path

- **WHEN** a log is asked for under the id `../audit`
- **THEN** nothing is read

#### Scenario: A change worked in its own worktree

- **WHEN** a change has a worktree of its own, a run there kept two logs,
  and the host's own root kept none
- **THEN** listing that change's logs answers both runs

#### Scenario: A change with no worktree of its own

- **WHEN** a change has no worktree of its own and the host's own root kept
  a log of its run
- **THEN** listing that change's logs answers that run from the host's root

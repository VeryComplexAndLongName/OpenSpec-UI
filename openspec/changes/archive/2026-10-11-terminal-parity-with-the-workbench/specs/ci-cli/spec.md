# CLI Capability Delta

## ADDED Requirements

### Requirement: The CLI lists and explains changes from core facts

`show changes` SHALL list active checkout/worktree changes with stage, task
progress, blockers and source. `show tasks <change>` SHALL retain task numbers,
text/evidence, state and human/delegate responsibility. `explain change <change>`
SHALL summarize facts and core-derived next actions without mutating the change.

#### Scenario: Active changes exist only in their own worktrees

- **WHEN** `show changes` reads a repository with such changes
- **THEN** they are included with their actual source and progress

#### Scenario: A task requires a person or declared delegate

- **WHEN** `show tasks` reads the change's owning task list
- **THEN** task numbers, evidence and closure responsibilities remain visible

#### Scenario: A change waits on a blocker or question

- **WHEN** `explain change` is requested
- **THEN** it names those facts and core-derived next actions without changing state

### Requirement: The CLI explains effective configuration and messages

`explain change-harness` SHALL show core-resolved terminal configuration, agents,
models, steps, gates and budgets. `show agents` SHALL list registry/provider and
terminal capability facts without claiming authentication. `explain message`
SHALL show the registered template, severity, reason, remedy and retirement status.

#### Scenario: Change overrides differ from defaults

- **WHEN** its harness is explained
- **THEN** the owning directory's effective configuration is shown without merging in CLI

#### Scenario: Configuration is invalid or terminal-incompatible

- **WHEN** its harness is explained
- **THEN** the problem is reported rather than silently replaced with defaults

#### Scenario: Agents are listed

- **WHEN** `show agents` runs
- **THEN** all registry entries and providers are present with truthful terminal support

#### Scenario: A message code is known or unknown

- **WHEN** `explain message` receives a code
- **THEN** known codes return their register entry and unknown codes exit 2

### Requirement: The CLI reports retained runs and recorded usage honestly

`show run <runId>` SHALL return ordered audit facts and retained output with
explicit missing/truncated limits, not equate a status instanceId with runId.
`show cost <change>` SHALL aggregate repository-wide recorded change usage
through core, deduplicating runs and keeping non-USD units/unmeasured runs separate.

#### Scenario: A known run's output was pruned

- **WHEN** it is shown by runId
- **THEN** retained metadata remains available and missing output is stated explicitly

#### Scenario: A requested run is unknown

- **WHEN** `show run` cannot find its runId
- **THEN** it exits 1 and does not show another run's records

#### Scenario: A change has measured and unmeasured runs across worktrees

- **WHEN** its cost is shown
- **THEN** recorded usage is aggregated once per run, unmeasured runs are visible
  and credits are not converted to dollars

#### Scenario: A change has no recorded runs

- **WHEN** its cost is shown
- **THEN** it returns zero recorded spend and zero runs, not a claim of free execution

### Requirement: The CLI shows the scoped artifact diff

`show diff <change>` SHALL use core's OpenSpec artifact diff at the resolved
working directory, including staged/unstaged/untracked artifacts. It SHALL label
the scope and expose truncation, never claim to include all implementation files.

#### Scenario: Artifacts include staged and untracked edits

- **WHEN** the change's diff is requested
- **THEN** both are included with scope and file names

#### Scenario: The artifact diff is empty or truncated

- **WHEN** core reports either condition
- **THEN** the CLI faithfully returns it, without fabricated code changes

### Requirement: The CLI sends signed notes to live runs

`send message <instanceId> <text>` SHALL use existing core signing, sender policy
and live-target resolution to queue a note. It SHALL report its messageId, not
claim delivery. Blank messages and unknown/expired targets SHALL be refused.

#### Scenario: A valid live target is addressed

- **WHEN** a note is sent
- **THEN** core writes a verifiable policy-compliant envelope and CLI reports queued id

#### Scenario: A message is blank or its target expired

- **WHEN** it is sent
- **THEN** no usable note is queued and the CLI reports the refusal

### Requirement: The CLI runs exactly one declared delegated task

`run task <change> <number>` SHALL resolve its number to the core task line and
invoke existing owning-worktree delegation with the declared agent. It SHALL
preserve leases, sandbox, audit, permissions, cancellation and evidence gates.
Ordinary/human-only tasks SHALL NOT be delegated by this command.

#### Scenario: A delegated task records evidence and completes

- **WHEN** `run task` executes it
- **THEN** only that task runs, events are retained, evidence is checked and exit is 0

#### Scenario: A run ticks without evidence or leaves the item open

- **WHEN** core finishes its gate
- **THEN** the CLI reports the gate outcome and exits 1, not silently succeeds

#### Scenario: The task is human-only, not delegated or its worktree is busy

- **WHEN** it is requested
- **THEN** the action is refused without spawning an agent

#### Scenario: A permission is unanswered or execution interrupted

- **WHEN** a task cannot obtain consent or is cancelled
- **THEN** core permission/cancellation policy applies and no success is claimed

### Requirement: Terminal rollback preserves core recovery protections

`rollback change` SHALL use core recovery eligibility and mutation protection,
with interactive confirmation and no force/yes bypass. Absent/incompatible
checkpoints, live writers and conflicting contents SHALL prevent restoration.

#### Scenario: An eligible restoration is confirmed

- **WHEN** the operator accepts the stated consequences
- **THEN** core restores only eligible change files under its mutation lease

#### Scenario: Confirmation is declined or no terminal can answer

- **WHEN** rollback is requested
- **THEN** it restores nothing and reports refusal

#### Scenario: Checkpoints are absent, incompatible or conflict with live work

- **WHEN** rollback is requested
- **THEN** it is refused without overriding core protections

### Requirement: New CLI pairs preserve existing contracts

All twelve new commands SHALL use the shared vocabulary and accept cwd/text/JSON
options. Reports SHALL keep diagnostics on stderr with registered identifiers.
Existing command names, exit codes and permission policies SHALL remain unchanged.

#### Scenario: Required arguments are missing

- **WHEN** a new command is invoked incompletely
- **THEN** it exits 2 with a registered diagnostic and performs no action

#### Scenario: A machine consumes new JSON output

- **WHEN** a report or task event stream is requested as JSON
- **THEN** it remains parseable without banner/diagnostic contamination

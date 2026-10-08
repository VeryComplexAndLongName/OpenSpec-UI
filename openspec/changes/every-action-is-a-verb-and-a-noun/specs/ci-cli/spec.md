## ADDED Requirements

### Requirement: Every subcommand is a verb and a noun

Every subcommand of `openspec-ui-cli` SHALL be a verb and a noun from the
product's lists (ADR 0045), in lower case: `validate changes`, `run change`,
`answer question`, `diagnose workspace`. A subcommand typed by a former
name SHALL be refused with exit code 2 and the message `error OSW-CLI-001:
'<former>' was renamed: use 'openspec-ui-cli <pair>' (ADR 0045)`, and
nothing SHALL run. Every message the CLI prints that names a subcommand
SHALL name it by its pair.

#### Scenario: A former name

- **WHEN** `openspec-ui-cli doctor` is run
- **THEN** it exits 2, printing `error OSW-CLI-001: 'doctor' was renamed: use
  'openspec-ui-cli diagnose workspace' (ADR 0045)`, and nothing else runs

#### Scenario: The merge gate

- **WHEN** the merge gate runs `openspec-ui-cli validate changes --change
  <id> --base <ref>`
- **THEN** it validates as `validate` did before

## MODIFIED Requirements

### Requirement: The CLI joins a person to the team and lists the people

`openspec-ui-cli join team --handle <handle> --name <text> [--email <address>]`
SHALL write or extend the person's file through the core, and exit `0`
when the file holds this machine's key, `1` when joining was refused, and
`2` when nothing could be read or written. `openspec-ui-cli show people` SHALL
list each person with their current and retired keys and each problem
with the files, and exit `1` when there is a problem.

#### Scenario: A key that is somebody else's

- **WHEN** `join` runs on a machine whose key is already in another
  person's file
- **THEN** it exits `1` and names whose key it is

### Requirement: The CLI says where each change is

`openspec-ui-cli show stages` SHALL list every active change with its stage,
how long it has been there, and its Owner and Implementer.
`openspec-ui-cli show stages <change>` SHALL print every stay in every stage,
with the fact that began it, and the time in each stage over all its
visits. Where the standings or the audit log cannot be read, it SHALL
leave out the facts they would have given and still answer, exiting `0`.
It SHALL exit `2` only where the changes themselves cannot be read.

#### Scenario: A change sent back once

- **WHEN** `stages <change>` runs for a change that was sent back from
  review and pushed again
- **THEN** it prints both stays In review, and the time In review over two
  visits

### Requirement: The terminal shows what the supervisor finds

`openspec-ui-cli show advice` SHALL print the supervisor's suggestions with the
others, in text and in JSON. `openspec-ui-cli run change` SHALL print a failed
run's diagnosis beneath its failure.

#### Scenario: A silent run seen from a terminal

- **WHEN** a run has said nothing new past the threshold and `advise` is
  run
- **THEN** the suggestion is printed with its reason and its commands

#### Scenario: A run that fails in the terminal

- **WHEN** `openspec-ui-cli run change` ends with a failed stage that carries a
  diagnosis
- **THEN** the cause, whether repeating can help, the quoted line and the
  remedy are printed after the failure

### Requirement: A task is closed, reopened and committed from a terminal

`openspec-ui-cli complete task <change> <number> [--note <text>]`, `task
reopen <change> <number> [--note <text>]` and `task commit <change>` SHALL
do what a card's controls do, under the same rules, in the change's own
worktree. They SHALL exit 0 on success, 1 on a refusal with its reason, and
2 where the request could not be attempted.

#### Scenario: Closing a Human-only task from a terminal

- **WHEN** `task done the-change 6.4 --note "seen"` is run
- **THEN** 6.4 is ticked with the note under it, and the command exits 0

#### Scenario: Without the note it needs

- **WHEN** `task done the-change 6.4` is run and 6.4 is Human-only
- **THEN** nothing is written, the reason is printed, and the command
  exits 1

### Requirement: The terminal says when the supervisor moved a stage

`openspec-ui-cli run change` SHALL print, under a repeated or moved stage's
heading, why it was attempted again and on which agent.

#### Scenario: A moved stage in the terminal

- **WHEN** a chain run from the terminal moves apply to another agent
- **THEN** the heading names the new agent and the attempt, and the line
  under it says the supervisor moved it and why

### Requirement: The CLI updates a plan

`openspec-ui-cli update plan <change> [--note <text>] [--agent <id>] [--cwd
<path>]` SHALL run `update` on the change, with the note in its prompt,
printing the run as `openspec-ui-cli run change` prints one, and SHALL exit
non-zero where the run fails. An agent's permission request SHALL be put to
the person at the terminal, as `run` puts a checkpoint; where the input is
not a terminal, it SHALL be denied, and the denial printed.

#### Scenario: A note from the terminal

- **WHEN** `openspec-ui-cli update plan demo --note "keep the target filter"` runs
- **THEN** the update's prompt holds the last review of `demo` and the note

#### Scenario: An agent asks for a permission

- **WHEN** the update's agent asks to edit `tasks.md` and nobody is at a
  terminal to answer
- **THEN** the request is denied, the denial is printed, and the run goes on
  instead of waiting for an answer

### Requirement: The CLI answers a question

`openspec-ui-cli answer question <change> <question-id> <text> [--cwd <path>]` SHALL
answer the question, writing `decisions.md` and the audit log and reaching
a run that waits on it. `openspec-ui-cli answer question <change>` SHALL list the
change's open questions with their ids. `openspec-ui-cli show status` SHALL list
each waiting run's open questions with their ids and the command that
answers each.

#### Scenario: From a terminal

- **WHEN** `openspec-ui-cli answer question demo Q-r1-1 "Active contacts only"` runs
- **THEN** `decisions.md` of `demo` holds that answer, and a run waiting on
  `Q-r1-1` goes on

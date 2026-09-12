## ADDED Requirements

### Requirement: What would stop a run can be asked before starting one

It SHALL be possible to ask what this machine and this workspace are
missing, without naming a change and attempting to run it.

The answer SHALL cover the runtime against the versions this repository
pins, the presence of the OpenSpec CLI, the presence of each registered
agent's executable, whether the workspace's harness configuration reads,
who holds the workspace, and whether a git identity is configured.

Each finding SHALL state whether it stops a run or is only worth
knowing, and SHALL name a remedy where the repository has a command for
one.

A workspace held by a live run SHALL be reported as a fact and SHALL NOT
be reported as something that stops a run: a busy workspace is not a
broken one.

#### Scenario: A machine missing something a run needs

- **WHEN** something a run requires is absent
- **THEN** it is named, marked as stopping a run, and the command that
  remedies it is named where one exists

#### Scenario: A workspace held by a live run

- **WHEN** a run holds the workspace
- **THEN** the holder is reported, and the report does not treat it as a
  failure

### Requirement: An agent's presence is answered by the detection that already exists

Whether an agent is installed SHALL be answered by the same detection
every other surface of this product reads, and SHALL NOT be determined a
second way inside this report.

A command that answered "is this agent here" differently from the agent
picker in the same build would make the product disagree with itself,
and a person would have no way to tell which answer to believe. If the
way presence is detected is wrong, it is wrong for every surface and is
changed in one place.

#### Scenario: Reporting on an installed agent

- **WHEN** the report covers an agent whose executable is installed
- **THEN** it reports what the shared detection reports, including the
  version where that detection has one

### Requirement: A report about one change is the preflight's own answer

Where the question is asked about a named change, the answer SHALL come
from the same resolution that would run it, including the setting that
governs any refusal — not from a second implementation of the same
conditions.

Two implementations of "may this change start" drift, and the drift
appears as a report that says yes to a run which is then refused.

#### Scenario: A change whose configuration refuses an unattended run

- **WHEN** the report is asked about a change whose configuration would
  refuse to start here
- **THEN** it states that refusal's own reason and the setting that
  governs it

## ADDED Requirements

### Requirement: What runs have cost in this workspace is readable back

The recorded history of runs SHALL be readable as an aggregate over the
workspace: per agent, and per agent and effort together.

Each group SHALL carry how many runs it rests on and how many of those
reported a cost. A median over fifteen samples and a median over two are
different claims, and a figure that does not say which will be believed
equally.

A group resting on fewer runs than the stated threshold SHALL be reported
as such rather than omitted. Omitting it makes "too little is known here"
indistinguishable from "this combination has never run", which are
different facts and lead to different decisions.

Runs recorded against a change that is neither active nor archived SHALL
be excluded. Such a change was deleted, and a deleted change is an
experiment rather than part of the project's record — counting one makes
the project's own testing look like its behaviour.

#### Scenario: An agent with enough recorded runs

- **WHEN** an agent has at least the threshold of paired runs
- **THEN** its group reports the figures together with the number of runs
  and the number that reported a cost

#### Scenario: A combination with too little recorded

- **WHEN** an agent and effort together have fewer runs than the
  threshold
- **THEN** the group is reported as below the threshold, with how many it
  has and how many are needed

#### Scenario: A run against a change that was deleted

- **WHEN** the audit log contains runs against a change that is neither
  in the active changes nor in the archive
- **THEN** those runs are excluded from every aggregate

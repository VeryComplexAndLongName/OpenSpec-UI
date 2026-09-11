## MODIFIED Requirements

### Requirement: What the verifying stages found is readable per agent

What a change's verifying stages found SHALL be readable back per agent,
beside what the runs cost, where the agent is the one whose work the
checks covered.

The audit log records how many checks a verifying stage ran and how many
failed. An agent that is cheap and fails its checks is not the cheap one,
and a surface that reports only cost invites exactly that reading.

A checks entry SHALL record the agent whose work it examined. The entry
is written by the runner, not by an agent, and grouping by its writer
yields one group that names no agent. An entry recorded before that
field existed SHALL be counted and reported as such, not charged to a
group.

A checks entry SHALL NOT be counted as a run anywhere runs are counted.
It is a fact about a run.

Each group SHALL carry how many verifying stages it rests on, and a group
resting on fewer than the stated threshold SHALL be reported as such
rather than omitted. Omitting it makes "too little is known here"
indistinguishable from "this agent never fails".

Where nothing has been recorded, the surface SHALL distinguish a log with
no runs from a log whose runs never reached a verifying stage. They are
different facts and only one of them is answered by running something.

Runs recorded against a change that is neither active nor archived SHALL
be excluded, by the same rule the cost figures apply.

#### Scenario: An agent whose checks have failed

- **WHEN** verifying stages have recorded what their checks found
- **THEN** each group names the agent whose work was checked, with its
  stages, failures and check counts

#### Scenario: An entry recorded before the agent was named

- **WHEN** a checks entry carries no checked agent
- **THEN** it is counted and reported as recorded before the agent was
  named, and no group is charged with it

#### Scenario: A checks entry beside a run

- **WHEN** one chain run performed an apply and a verify with declared
  checks
- **THEN** the run count everywhere is one

#### Scenario: Too few stages to read as a rate

- **WHEN** an agent has fewer verifying stages than the threshold
- **THEN** it is shown and reported as resting on too few

#### Scenario: A log whose runs never verified

- **WHEN** runs are recorded but none reached a verifying stage
- **THEN** the surface says so, distinctly from having no runs at all

### Requirement: Recommendations are drawn from the workspace's own runs

Where the recorded runs support a comparison, the run entry SHALL offer
recommendations drawn from them, each named for what it recommends and
carrying the observation it was drawn from.

A name that states the conclusion — the cheapest, the fastest, the most
likely to finish — is what makes a recommendation usable without reading
the table it came from. The observation beside it is what makes it
arguable.

A recommendation SHALL NOT be offered where its comparison cannot be
made. A superlative over one candidate is not a comparison, and
presenting it as one claims a distinction that was never established.

Where a recommendation is not offered, the reason SHALL say which of
these is so: nothing reported the measure, something reported it but
rests on too few runs, or one candidate is eligible and has nothing to
compare against. "Nothing reported a cost" said of runs that did is a
reason that is false.

Where candidates tie on the measure, all of them SHALL be named. Breaking
a tie arbitrarily presents a fabricated distinction as a finding.

A group resting on fewer runs than the aggregate's threshold SHALL NOT
win a recommendation. The threshold exists because a figure over too few
runs is not an answer, and a superlative is the one place a figure is
stated as an answer rather than as a reading.

#### Scenario: Two agents that reported a cost

- **WHEN** at least two agents have recorded costs above the threshold
- **THEN** the cheapest is recommended by name, with its median cost and
  the runs behind it

#### Scenario: Only one agent reports a cost

- **WHEN** one agent has recorded costs and the others have none
- **THEN** no cost recommendation is offered, and the reason names that
  agent as the only one

#### Scenario: Costs reported by too few runs

- **WHEN** agents have recorded costs but each rests on fewer runs than
  the threshold
- **THEN** no cost recommendation is offered, and the reason says the
  runs are too few, not that none reported

#### Scenario: A tie on the measure

- **WHEN** two agents are equal on the measure being recommended
- **THEN** both are named

#### Scenario: A candidate below the threshold

- **WHEN** the best figure belongs to a group with fewer runs than the
  threshold
- **THEN** it does not win the recommendation

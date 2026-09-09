## ADDED Requirements

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
- **THEN** no cost recommendation is offered

#### Scenario: A tie on the measure

- **WHEN** two agents are equal on the measure being recommended
- **THEN** both are named

#### Scenario: A candidate below the threshold

- **WHEN** the best figure belongs to a group with fewer runs than the
  threshold
- **THEN** it does not win the recommendation

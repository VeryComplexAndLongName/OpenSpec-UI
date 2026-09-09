## ADDED Requirements

### Requirement: The run entry shows what runs have cost in this workspace

The entry that starts a run SHALL show what the workspace's recorded runs
have cost and how long they took, per agent, alongside how many runs each
figure rests on.

This is where a person decides what to spend, and the figures answering
"what does this usually cost here" are recorded and were shown nowhere.

Where a group rests on fewer runs than the threshold, the entry SHALL say
so rather than omit the group or present its figures as an answer.

Where nothing has been recorded, the entry SHALL say that statistics are
still accumulating and how much has been read, rather than showing an
empty space. A surface that looks identical before and after a run has
happened gives a reader no way to tell it is working.

#### Scenario: An agent with enough recorded runs

- **WHEN** the run entry is opened in a workspace where an agent has at
  least the threshold of recorded runs
- **THEN** its median cost and duration are shown with the number of runs
  behind them

#### Scenario: An agent that reports no cost

- **WHEN** an agent's runs are recorded but none reported a cost
- **THEN** the entry shows the duration figures and says the cost is not
  reported, rather than showing a cost of zero

#### Scenario: Nothing recorded yet

- **WHEN** no runs have been recorded for this workspace
- **THEN** the entry says so and states how many entries were read

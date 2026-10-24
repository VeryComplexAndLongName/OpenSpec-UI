## ADDED Requirements

### Requirement: An ACP agent's stderr is read, handed on and said beside a failure

The ACP session driver SHALL read a spawned agent's stderr from the moment
it is spawned until it exits, so that no amount of it stalls the agent. It
SHALL hand what it reads on as `stderr` events of the run, in the order it
arrived relative to the run's other events. Where the run fails, its reason
SHALL end with the last of what the agent wrote to stderr, at most 4000
characters, where the agent wrote anything there.

#### Scenario: An agent that is not signed in

- **WHEN** an ACP agent writes "Error: not signed in" to stderr and closes
  its connection before answering
- **THEN** the run carries that line as a `stderr` event, and its failure
  says "The agent's stderr ended with:" followed by that line

#### Scenario: An agent that writes a great deal to stderr

- **WHEN** an ACP agent writes more to stderr than its pipe holds while it
  works
- **THEN** it is not stalled by it, and every chunk reaches the run's
  events

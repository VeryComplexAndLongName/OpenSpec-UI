## ADDED Requirements

### Requirement: Cancelling a chain from the Processes tree stops the chain

Cancelling a chain's process from the Processes tree SHALL cancel the chain
itself, identified by the chain's own run id. It SHALL NOT only withdraw the
chain's entry from the scheduler while the chain runs on.

#### Scenario: A running chain

- **WHEN** Cancel Process is used on a running chain in the Processes tree
- **THEN** the chain is cancelled, and its agent's process ends

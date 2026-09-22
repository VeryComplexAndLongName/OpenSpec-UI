## ADDED Requirements

### Requirement: DeepSeek is an agent, over its CLI's ACP profile

`packages/core` SHALL offer the agent `deepseek-cli-acp`. It SHALL run
`dsh --profile acp` through the shared ACP driver, and the default
allowlist SHALL permit exactly that invocation. Every prompt it is given
SHALL begin with a preamble asking it to follow the instructions literally
and in order. Where the process closes before the agent has said anything,
the run's failure SHALL name the Node version found on the PATH it was
started with.

#### Scenario: A change is implemented by DeepSeek

- **WHEN** a stage names `deepseek-cli-acp` and `dsh` runs on a Node it
  supports
- **THEN** the run streams the agent's updates and ends as the agent ends
  it

#### Scenario: dsh exits without a word

- **WHEN** `dsh` closes before sending any update
- **THEN** the run fails with a reason that says so and names the Node it
  met

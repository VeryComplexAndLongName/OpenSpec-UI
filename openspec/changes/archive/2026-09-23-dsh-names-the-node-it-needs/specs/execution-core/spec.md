## MODIFIED Requirements

### Requirement: DeepSeek is an agent, over its CLI's ACP profile

`packages/core` SHALL offer the agent `deepseek-cli-acp`. It SHALL run
`dsh --profile acp` through the shared ACP driver, and the default
allowlist SHALL permit exactly that invocation. Every prompt it is given
SHALL begin with a preamble asking it to follow the instructions literally
and in order.

`dsh` SHALL NOT be started on a Node that cannot run it. Before spawning,
the adapter SHALL ask the Node on the PATH its version; where that version
is below what `dsh` needs, the run SHALL fail at once with a reason naming
the version found and the versions that work. Where the version cannot be
read, the run SHALL go ahead, and where the process closes before the
agent has said anything, the run's failure SHALL name the Node version
found on the PATH it was started with.

#### Scenario: A change is implemented by DeepSeek

- **WHEN** a stage names `deepseek-cli-acp` and `dsh` runs on a Node it
  supports
- **THEN** the run streams the agent's updates and ends as the agent ends
  it

#### Scenario: The Node on the PATH is too old

- **WHEN** a stage names `deepseek-cli-acp` and the Node that would start
  `dsh` is below what `dsh` needs
- **THEN** nothing is spawned, and the run fails with a reason naming the
  Node found and the versions that work

#### Scenario: dsh exits without a word

- **WHEN** `dsh` closes before sending any update
- **THEN** the run fails with a reason that says so and names the Node it
  met

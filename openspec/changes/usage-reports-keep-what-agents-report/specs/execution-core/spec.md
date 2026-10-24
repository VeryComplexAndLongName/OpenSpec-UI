## ADDED Requirements

### Requirement: Recorded usage belongs to an agent invocation

The runner SHALL record a fresh invocationId and, when supplied, the
requestedModel on each invocation's started and terminal audit entries.
The chain runId SHALL remain unchanged. Reports SHALL count every
invocation's terminal usage, including repeated stages sharing a runId,
and SHALL pair legacy entries without discarding subsequent terminal
usage. Messages and mechanical chain/checks facts SHALL NOT count as agent
invocations. Missing usage SHALL remain distinguishable from measured zero.

#### Scenario: A chain invokes two stages and repeats one

- **WHEN** three invocations share one runId and report 100, 200, and 300 input tokens
- **THEN** the report contains 600 input tokens, one logical run, and three measured invocations
- **AND** the existing Harness budget reader receives the complete sum

#### Scenario: Old audit entries have no invocation id

- **WHEN** legacy start/terminal pairs or terminal-only records contain usage for multiple stages
- **THEN** every terminal invocation contributes once without counting its start twice

#### Scenario: A requested model travels outside argv

- **WHEN** an ACP invocation requests a model through a session option
- **THEN** both audit entries retain requestedModel independently of invocation.args
- **AND** a request without a model leaves that field absent

### Requirement: Usage summaries preserve reported fields and uncertainty

Summaries SHALL retain reported input, output, cache-read, cache-creation,
and thought tokens separately. Unknown USD cost SHALL remain absent;
reported zero SHALL remain zero. Summaries SHALL expose USD coverage for
their measured invocations and SHALL NOT estimate prices or convert units.

#### Scenario: One token-only invocation follows a priced invocation

- **WHEN** two invocations report usage but only one reports USD
- **THEN** the sum contains only the reported dollars and states one of two invocations reported USD
- **AND** a group with no reported USD has no costUsd field

#### Scenario: Cached and thought tokens were reported

- **WHEN** usage contains cache-read, cache-creation, and thought counters
- **THEN** those fields survive agent, change, and model aggregation wherever supplied
- **AND** they are not added into input or output a second time

### Requirement: Codex ACP model figures retain their attribution limit

Codex ACP quota model metadata SHALL be preserved in usage.byModel with
current-model attribution. Overall totals SHALL NOT add this breakdown to
the already reported usage. Invalid metadata SHALL drop only invalid
fields and SHALL NOT fail an otherwise successful run.

#### Scenario: Codex ACP returns quota model usage

- **WHEN** a prompt response carries _meta.quota.model_usage with a model and token_count
- **THEN** usageReported and audit retain those reported model figures with current-model attribution
- **AND** a malformed entry does not discard valid overall usage

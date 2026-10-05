## ADDED Requirements

### Requirement: The supervisor acts only where a change allows it

`supervisor.mode: "act"` SHALL be accepted only in a change's own
`harness.json`, only where that file sets `autonomyLevel: "autonomous"`,
and only where the resolved `maxStageAttempts` is above 1. Otherwise it
SHALL be refused where the configuration resolves, naming the rule.

`supervisor.allowCostIncrease` and `supervisor.allowProviderChange` SHALL
be accepted only in a change's own file and SHALL mean false where absent.
`supervisor.fallback` SHALL be accepted in either file, as an ordered list
of registered agents per agent stage, without `vscode-chat` and without a
repeated id.

#### Scenario: Act in the global file

- **WHEN** `openspec/agent-harness.json` sets `supervisor.mode: "act"`
- **THEN** resolving the configuration fails and says act is set per change

#### Scenario: Act without an attempt to spend

- **WHEN** a change's file sets `act` and `maxStageAttempts` resolves to 1
- **THEN** resolving the configuration fails and names `maxStageAttempts`

### Requirement: A failed stage is repeated or moved under act, and said

Under `act`, when a chain's stage fails and an attempt is left, the chain
SHALL:

- attempt the stage again on the same agent where the failure's diagnosis
  says repeating is likely to help;
- move the stage to the first agent of `supervisor.fallback.<stage>` not
  yet tried in it that the policy allows, where the diagnosis says
  repeating will not help;
- otherwise end with the stage's failure, as without `act`.

A move to an agent of another provider SHALL need
`allowProviderChange`, and a move to any agent that is not the local model
SHALL need `allowCostIncrease`. A moved stage SHALL run its new agent with
that agent's defaults.

Every repeat and move SHALL be said in the chain's events and recorded in
the audit log, with the agent, the cause and, for a fallback refused, the
rule that refused it. A chain SHALL yield no `failed` event for a stage it
goes on to attempt again.

#### Scenario: Not signed in, with a fallback allowed

- **WHEN** under `act`, `apply` fails on `copilot-cli-acp` diagnosed as not
  signed in, its fallback is `claude-cli-acp`, and both allowances are true
- **THEN** the chain says it moved apply to `claude-cli-acp` because the
  agent is not signed in, records it, and attempts apply on
  `claude-cli-acp`

#### Scenario: A fallback the policy refuses

- **WHEN** the same happens with `allowProviderChange` false
- **THEN** the chain ends with apply's failure, and says the fallback
  `claude-cli-acp` was refused because it is another provider

#### Scenario: A rate limit

- **WHEN** under `act`, a stage fails diagnosed as rate-limited with an
  attempt left
- **THEN** the stage is attempted again on the same agent, and the chain
  says why

#### Scenario: Advise names the fallback

- **WHEN** under `advise`, a change's last run failed at apply for a cause
  repeating cannot fix, and apply has an allowed fallback
- **THEN** the supervisor's suggestion names that agent and changes nothing

## ADDED Requirements

### Requirement: A named configuration names an effort level, not a value

A named configuration SHALL declare where in an agent's own effort range
it sits, and the value SHALL be resolved when it is applied, against the
agent that stage uses.

Effort vocabularies differ between agents: `copilot` accepts seven
values, `claude` five, `codex` four, and five agents accept none. A
configuration storing a literal is wrong for some agent the moment it is
applied, and shipping one the validator would then reject is shipping a
configuration the product refuses.

A named configuration SHALL NOT set a model. Applying one would discard
the model the workspace already chose, no model name it could ship can be
checked against the CLI that will receive it, and which model to use is
not a question a named configuration was asked. Each SHALL say so in its
own text, so a reader is not left to infer it from an absence.

Where two levels resolve to the same value for an agent, or where the
agent accepts no effort at all, that SHALL be reported rather than
presented as configurations that differ.

#### Scenario: The same level against different agents

- **WHEN** the highest level is resolved for an agent accepting five
  values and for one accepting four
- **THEN** each resolves to that agent's own highest value

#### Scenario: An agent that accepts no effort

- **WHEN** a configuration is resolved for an agent with no effort values
- **THEN** it sets no effort, and the surface says the configurations
  differ only in their ceilings for this agent

#### Scenario: Two levels landing on one value

- **WHEN** an agent's range is narrow enough that two levels resolve
  alike
- **THEN** that is reported rather than shown as two distinct choices

## MODIFIED Requirements

### Requirement: Named configurations are titled by what is being chosen between

The named configurations SHALL be titled by the effort they ask for, and
each SHALL state its ceilings and where each figure came from.

Effort is what the product can set honestly: every agent declares which
values it accepts. Cost and time are ceilings rather than prices, and a
title carrying one was read as what a run would cost — the confusion a
title naming the effort does not create. The figures remain, stated with
their basis, and are no longer the name.

A configuration SHALL NOT claim a property the product does not control.
Nothing here makes an agent work faster, and nothing here chooses a
model; a title claiming either is the same defect as a configuration
promising behaviour it does not set.

#### Scenario: Comparing the configurations

- **WHEN** the named configurations are offered
- **THEN** each states the effort it asks for, its ceilings, and where
  each figure came from

#### Scenario: The configuration that claims speed

- **WHEN** the named configurations are read
- **THEN** none of them claims speed, because nothing here makes an agent
  work faster — a title claiming it is the same defect as a configuration
  promising behaviour it does not set

#### Scenario: A configuration and the model

- **WHEN** a named configuration is read
- **THEN** it says the model is whichever the workspace already
  configured, rather than leaving that to be inferred from an absence

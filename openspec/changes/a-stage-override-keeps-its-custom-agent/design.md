# Design

## Decision: the merge is driven by the field list, not by three names

`STEP_AGENT_KEYS` already names every field a stage entry may carry.
`mergeStepAgent` iterates it, so the next field added to a stage entry
is merged without anyone remembering to teach the merge. The one rule
that stays explicit is the agent rule: a different agent inherits
nothing. The bare-string collapse checks that no field other than
`agent` survived, by the same list.

## Decision: the settings view applies a template against the resolved view

The run dialog has it right: a template's effort belongs to the agent
the stage will actually run, which for an inherited stage is the global
one. The settings view resolves the override over the global before
computing the effort form, writes an explicit stage entry naming that
agent and effort, and its message says which stages were given an effort
and which agents accept none. "Inherit" stays available for a person who
clears it, but applying a configuration is a choice to set something.

Both surfaces call one core function to produce what is written, so a
future divergence has nowhere to live.

## Decision: describe a level by its position, not by a synonym

"Balanced" resolves to a value one third up an agent's range. The
template's intent says so — "a third of the way up this agent's range" —
and `HARNESS.md` gives the resolved value per registered agent in the
table the design already has, so a reader of `copilot-cli` sees `low`
before choosing. "Middle" is retired from both.

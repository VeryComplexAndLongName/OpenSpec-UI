## ADDED Requirements

### Requirement: A settings view sets a stage's model and the run budget

A harness settings view SHALL offer each stage's model where the stage's
agent accepts one, and SHALL save it as that stage's model. A stage whose
agent accepts no model SHALL offer none.

A harness settings view SHALL offer the run budget, the chain's cost ceiling
in US dollars, and SHALL save it as `budget.maxCostUsd`, keeping every other
budget key. An empty run budget SHALL save no `maxCostUsd`; in a change's
view it SHALL mean the global value is inherited, and the view SHALL say
which value that is.

#### Scenario: A model set in the view

- **WHEN** a model is entered for a stage whose agent accepts one, and the
  settings are saved
- **THEN** the stage's entry names the agent and that model

#### Scenario: An agent that accepts no model

- **WHEN** a stage's agent accepts no model
- **THEN** no model field is offered for that stage, and no model is saved
  for it

#### Scenario: The run budget

- **WHEN** a run budget of 15 is entered and the settings are saved, in a
  file whose budget also sets `maxTokens`
- **THEN** the saved budget sets `maxCostUsd` to 15 and keeps `maxTokens`

### Requirement: A settings view can discard what it has not saved

A harness settings view with unsaved changes SHALL offer to discard them,
and discarding SHALL read the file again and show what it holds. With
nothing unsaved, the offer SHALL be unavailable.

#### Scenario: Discarding

- **WHEN** a field is changed and Discard is used
- **THEN** the view shows the file's values again, and says nothing is
  unsaved

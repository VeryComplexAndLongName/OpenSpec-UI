## ADDED Requirements

### Requirement: A "Run with Agentic Harness" action dispatches by resolved autonomy level

Both delivery targets SHALL offer a "Run with Agentic Harness" action on a
change. Invoking it SHALL resolve that change's harness configuration
fresh (not a cached value) and dispatch to the Agent Selection picker for
that change when the resolved `autonomyLevel` is `"assisted"` (the
picker's own existing `stepAgents` pre-fill for whichever stage the user
selects is unchanged — this action does not add new stage auto-selection
beyond what the picker already does); and to a chain run (the `"chain"`
command from the `agentic-harness` capability's chain-execution
requirements) when the resolved `autonomyLevel` is `"semi-autonomous"` or
`"autonomous"`. The action SHALL NOT override or bypass the resolved
configuration in either case.

#### Scenario: Assisted change opens the picker

- **WHEN** "Run with Agentic Harness" is invoked for a change whose
  resolved `autonomyLevel` is `"assisted"`
- **THEN** the Agent Selection picker opens for that change, and no chain
  is started

#### Scenario: Semi-autonomous or autonomous change starts a chain

- **WHEN** "Run with Agentic Harness" is invoked for a change whose
  resolved `autonomyLevel` is `"semi-autonomous"` or `"autonomous"`
- **THEN** a `"chain"` command starts for that change instead of opening
  the single-stage picker

#### Scenario: Resolution is re-read on every invocation

- **WHEN** a change's per-change `harness.json` is edited between two
  invocations of "Run with Agentic Harness" for the same change
- **THEN** the second invocation dispatches according to the newly edited
  configuration, not a value cached from the first invocation

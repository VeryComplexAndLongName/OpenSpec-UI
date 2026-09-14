## ADDED Requirements

### Requirement: The OpenSpec config parses, or the lint gate fails

The lint gate SHALL parse `openspec/config.yaml` and SHALL fail when it does
not parse, naming the line the parser gives.

It SHALL also fail when the parsed file lacks any of the top-level keys
`schema`, `context`, `rules` or `operations`.

`openspec` ignores a config it cannot parse and carries on, so no other
check notices when the rules stop reaching a run.

#### Scenario: A plain list item with a colon and a space

- **WHEN** a rule in `openspec/config.yaml` is a plain multi-line scalar
  that contains `: `
- **THEN** the lint gate fails and names that file and line

#### Scenario: A config that parses

- **WHEN** `openspec/config.yaml` parses and has every required top-level
  key
- **THEN** the OpenSpec config check passes

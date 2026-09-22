## ADDED Requirements

### Requirement: The CLI says where each change is

`openspec-ui-cli stages` SHALL list every active change with its stage,
how long it has been there, and its Owner and Implementer.
`openspec-ui-cli stages <change>` SHALL print every stay in every stage,
with the fact that began it, and the time in each stage over all its
visits. Where the standings or the audit log cannot be read, it SHALL
leave out the facts they would have given and still answer, exiting `0`.
It SHALL exit `2` only where the changes themselves cannot be read.

#### Scenario: A change sent back once

- **WHEN** `stages <change>` runs for a change that was sent back from
  review and pushed again
- **THEN** it prints both stays In review, and the time In review over two
  visits

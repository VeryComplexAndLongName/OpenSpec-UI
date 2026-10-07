## ADDED Requirements

### Requirement: The plan can be updated from the panel and the card

The AI panel SHALL offer `update` among its commands, with its purpose,
and, when it is chosen, a field for notes for the update that says it also
reads the change's last completed review. A change's card SHALL offer **Update the plan**
where the change's last run was a review whose verdict was `changes
needed`.

#### Scenario: After a review that asks for changes

- **WHEN** a change's last run was a review with verdict `changes needed`
- **THEN** its card offers **Update the plan**, which opens the panel with
  `update` chosen and a field for notes

## ADDED Requirements

### Requirement: A change keeps its history in signed files

`packages/core` SHALL read a change's history from
`openspec/changes/<id>/history/`, one signed envelope per file. Each
payload SHALL name:

- its kind, one of `owner-set`, `implementer-set` and `sent-back`;
- the change;
- the time, as claimed;
- the signer, by handle and key id;
- whether a person or an agent acted.

A `sent-back` event SHALL name a stage a change can go back to (proposed,
planned, in-progress, in-review), give a reason, and list each task item
it reopened with why. Each file SHALL be verified against the people in
`openspec/people/`.

#### Scenario: An agent's event

- **WHEN** an agent records an event for its person
- **THEN** the file is signed with the person's key and says the agent
  acted

### Requirement: Who holds a change is played forward from its history

The core SHALL play a history in the order its events claim, and refuse
any event that breaks a rule, saying why. A refused event SHALL change
nothing. The rules are:

- the first Owner is set by anyone on the team;
- after that only the Owner hands the ownership on;
- the Owner sets the Implementer;
- the Implementer may set none;
- only the Owner or the Implementer sends a change back;
- everyone named is on the team;
- a file signed by a key in nobody's file, or about another change, is
  refused.

#### Scenario: A hand-over by a bystander

- **WHEN** someone other than the Owner sets a new Owner
- **THEN** the event is refused with "only the Owner, <handle>, hands the
  ownership on", and the Owner stays who they were

### Requirement: Recording an event checks it first and commits nothing

Recording an event SHALL sign it with this machine's key and write it
only after checking it against the history already there. It SHALL
refuse a key that is in nobody's file, a retired key, and a change that
is not active. Sending back SHALL reopen the items it names in
`tasks.md`, each with a line under it saying when, by whom and why, and
SHALL leave `tasks.md` as it was where the event cannot be written. Where
the caller does not say who acted, the environment SHALL decide:
`OPENSPEC_UI_AGENT`, `AI_AGENT`, or `CLAUDECODE`, and otherwise a person.

#### Scenario: Sending back with a reopened item

- **WHEN** the Owner sends a change back to in-progress reopening 2.3
- **THEN** 2.3 is unticked in `tasks.md` with the reason under it, and one
  `sent-back` file is added to the history

### Requirement: History is only ever added to

Compared with the ref it merges into, a pull request SHALL NOT delete or
change a history file. A file moved unchanged into its change's archived
directory SHALL count as kept. A file the pull request adds SHALL check
out, be signed by someone on the team, and keep the rules when played
with everything before it. A file the base already has SHALL NOT be
judged again.

#### Scenario: A history file edited

- **WHEN** a pull request changes one byte of a history file on the base
- **THEN** the merge gate fails, saying history is only ever added to

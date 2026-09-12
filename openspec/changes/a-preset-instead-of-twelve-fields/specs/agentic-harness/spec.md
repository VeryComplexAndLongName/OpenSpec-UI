## ADDED Requirements

### Requirement: An intention can be configured in one action

A person SHALL be able to configure the harness by naming the intention
they have — run this with me watching, run this without me — rather than
by setting each field that intention implies.

Such a named set SHALL be expressed entirely in configuration keys that
already exist, and applying it SHALL write those keys as ordinary values
into the file they already live in. It SHALL NOT introduce a
configuration layer of its own: nothing SHALL record which named set was
applied, and nothing SHALL consult one while a chain runs.

A file written this way is a file a person can read, review, hand-edit
and commit. A file that named a preset and took its behaviour from a
table elsewhere would answer "what is set here" only by reference to
that table.

Applying one to a file that already carries values SHALL report the keys
it will overwrite, and their current values, before writing.

A named set SHALL declare which files it may be applied to, and SHALL be
offered only where it applies — not offered and refused.

#### Scenario: Configuring an unconfigured change

- **WHEN** a person applies a named set to a change with no
  configuration of its own
- **THEN** the change's configuration file carries that set's values as
  ordinary keys, and resolves exactly as those keys resolve when written
  by hand

#### Scenario: Applying over existing values

- **WHEN** a named set is applied to a file that already sets some of
  the same keys
- **THEN** the keys that would be overwritten, and their current values,
  are reported before anything is written

#### Scenario: A set whose values a global file may not carry

- **WHEN** a named set includes a value that only a per-change file may
  set
- **THEN** it is not offered for the workspace-wide file at all, and
  applying it there is refused with the same error that key's validator
  already raises

### Requirement: Fields remain the way anything specific is reached

Offering named sets SHALL NOT remove or hide the individual fields.

A named set is a starting point. A person whose intention is nearly one
of the offered sets SHALL be able to apply it and then edit any field it
set, in the same surface, without undoing the rest.

#### Scenario: Editing after applying

- **WHEN** a person applies a named set and then changes one field
- **THEN** that field is changed and every other value the set wrote is
  left as it was

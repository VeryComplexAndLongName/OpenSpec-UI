## ADDED Requirements

### Requirement: The editor's own pictures are taken by a spec

Every picture showing the editor's views, menus or panels SHALL be
produced by a spec that drives a real editor, and SHALL NOT be taken by
hand.

The spec SHALL wait for what it is capturing rather than for a duration,
and SHALL capture a window of a stated size, so that a difference
between two runs is a difference in the product.

#### Scenario: A view the documentation shows

- **WHEN** the pictures are regenerated
- **THEN** each editor picture is produced by the spec, against a real
  editor

#### Scenario: A picture added by hand

- **WHEN** a picture of the editor is added without a spec that takes it
- **THEN** the check that guards this reports it

### Requirement: A capture does not publish the machine it was taken on

A capture SHALL NOT include the account name, the machine name, or any
path carrying either.

Where such a region cannot be arranged out of the picture, it SHALL be
masked rather than cropped, so that what was hidden is visible as having
been hidden.

#### Scenario: A workspace whose path carries an account name

- **WHEN** the editor is captured with a workspace open
- **THEN** nothing identifying the machine appears in the picture

### Requirement: Editor pictures are taken against a fixture, not against this repository

The workspace the editor is captured with SHALL be a fixture whose
contents are fixed.

It SHALL NOT be the repository being worked in: a picture taken against
live contents changes when the work changes rather than when the screen
does.

#### Scenario: The pictures are regenerated twice with no product change

- **WHEN** nothing about the product has changed between two runs
- **THEN** the pictures do not change

### Requirement: The hand-taken exception remains, and is empty

The mechanism that permits a hand-taken picture SHALL remain, and SHALL
record nothing.

Removing it would make the next hand-taken picture permissible by
silence; leaving it empty keeps adding one a visible edit that states
its reason.

#### Scenario: A hand-taken picture is proposed

- **WHEN** somebody adds a picture no spec takes
- **THEN** it must be listed with a reason, and the listing is a change
  a reader can see

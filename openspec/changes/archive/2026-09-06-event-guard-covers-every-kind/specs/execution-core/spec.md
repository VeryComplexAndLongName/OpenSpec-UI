## ADDED Requirements

### Requirement: Every defined event kind survives a transport

An event the core emits SHALL be accepted by the protocol's own
validation for every kind the protocol defines, so that a surface
receiving events over a transport sees what the core emitted rather than
a silently filtered subset.

Where an event kind is added to the protocol, the system SHALL fail its
own checks until that kind's validation exists — a new kind SHALL NOT be
able to reach a transport while being rejected by it.

Validation SHALL continue to reject a payload whose kind the protocol
does not define, rather than raising an error on it.

#### Scenario: An event of a recently added kind

- **WHEN** an event of any kind the protocol defines is sent over a
  transport
- **THEN** it is accepted and delivered to the surface

#### Scenario: A kind added without validation

- **WHEN** a new event kind is added to the protocol and its validation
  is not
- **THEN** the project's own checks fail, rather than the kind being
  discarded at runtime

#### Scenario: A payload of an unknown kind

- **WHEN** a payload arrives whose kind the protocol does not define
- **THEN** it is rejected as invalid, and nothing throws

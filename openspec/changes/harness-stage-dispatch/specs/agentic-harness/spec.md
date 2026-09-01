## ADDED Requirements

### Requirement: A stage may be dispatched through the host's chat instead of a spawned CLI

A stage entry MAY declare that it is dispatched through the host's own
chat rather than by spawning a CLI. When it does, the host SHALL hand the
stage's prompt to its chat and report the stage as handed off — never as
completed, because the work has not been performed at that point and
nothing observes whether it ever is.

This dispatch SHALL be accepted only under the `assisted` autonomy level,
and only in a delivery target that has such a chat. Any other
combination SHALL be rejected when the configuration is read, before a
run starts, rather than falling back to spawning a CLI.

Omitting the dispatch declaration SHALL behave exactly as before this
capability existed.

#### Scenario: A stage declares chat dispatch under `assisted`

- **WHEN** a stage declaring chat dispatch is run in a delivery target
  that has a chat, with `autonomyLevel: assisted`
- **THEN** the host opens its chat with the stage's prompt, and the run
  reports the stage as handed off, with no completion reported for it

#### Scenario: Chat dispatch combined with a chain autonomy level

- **WHEN** a stage declares chat dispatch and the resolved autonomy level
  is `semi-autonomous` or `autonomous`
- **THEN** reading the configuration fails with an error naming the
  stage, because a chain advances on a completion signal that a
  handed-off stage cannot produce

#### Scenario: Chat dispatch in a delivery target with no chat

- **WHEN** a stage declaring chat dispatch is resolved by a delivery
  target that has no such chat
- **THEN** it is reported as an error naming the stage, and no CLI is
  spawned in its place

#### Scenario: No dispatch declared

- **WHEN** a stage entry declares no dispatch
- **THEN** it is spawned as a CLI exactly as before, and is observed,
  streamed and audited as before

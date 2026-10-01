## MODIFIED Requirements

### Requirement: The fixed stages stay fixed

A declaration SHALL NOT remove a fixed stage, replace one, or change the
order they run in. It inserts only.

Only `skipStages` leaves a fixed stage out, and only a stage it accepts.
The chain SHALL say on its own timeline which stage it skipped and why,
so a transcript still reads the same way as every other.

A chain's fixed sequence is what lets somebody who has watched one
change's run read another's. A change able to delete a stage would
produce a transcript that means something different from every other
transcript, and could not be read without first opening that change's
configuration.

#### Scenario: Every fixed stage still runs

- **WHEN** a change declares steps and its chain runs, and `skipStages` is
  absent
- **THEN** each fixed stage the chain would have run still runs, in the
  order it always did

#### Scenario: A skipped stage is said

- **WHEN** a chain would have run `review`, and the resolved `skipStages`
  names it
- **THEN** `review` does not run, the next stage runs in its place, and
  the chain's timeline says "review skipped: skipStages leaves it out"

## ADDED Requirements

### Requirement: A harness may leave the review stage out

A harness configuration SHALL accept `skipStages`, a list of stages a chain
leaves out, in the global file and in a per-change file. It SHALL accept
`review` and no other stage, and SHALL refuse any other name, a repeated
name, or a value that is not a list. A per-change `skipStages` SHALL
replace the global one whole; `[]` in a per-change file runs every stage.

A declared step placed before or after a skipped stage SHALL be refused
where the configuration resolves, naming the step and the stage: it would
otherwise never run, and say nothing.

Core's findings SHALL NOT judge a skipped stage: a ceiling that cannot act
on a stage that does not run is not worth a warning.

Asked for by the owner on 2026-09-27. With no agent set, `review` runs on
the host's default agent; there was no way to leave it out.

#### Scenario: review is skipped

- **WHEN** the resolved configuration's `skipStages` is `["review"]` and a
  chain starts at `propose`
- **THEN** the chain runs `propose`, then `apply`, and `review` does not run

#### Scenario: A stage that may not be skipped

- **WHEN** a configuration's `skipStages` names `verify`
- **THEN** the configuration is refused, naming `review` as the only stage
  that may be left out

#### Scenario: A per-change file puts review back

- **WHEN** the global file skips `review` and a change's `harness.json`
  sets `skipStages` to `[]`
- **THEN** that change's chain runs `review`

#### Scenario: A step placed against a skipped stage

- **WHEN** a change declares a step `after` `review` and `skipStages` names
  `review`
- **THEN** resolving that change's configuration is refused, naming the
  step and `review`

## Why

A reader who already knows BMAD (the BMad Method) asks, on meeting this
repository, whether it is the same thing; the owner asked exactly that on
2026-09-13. The answer is "alike in the idea, different where it
matters", and `README.md` gives a reader nothing to reach it with:

- **What they share.** Both work from written documents rather than
  from a conversation. Both split the work into steps that different
  expertise, or different agents, take in turn, and both put a check
  between building and accepting.
- **Where they differ.** This repository keeps a change's specification
  after it ships, and runs the agents itself: it has stages, an autonomy
  level, review gates, checkpoints, spending ceilings, an audit log, a
  lease on the working directory, and a picture of what can run
  alongside what. BMAD describes a method, and ships it as skills and
  workflows for the reader's own AI coding tool.

`Why not just openspec view` already answers the same kind of question
about the OpenSpec CLI. A reader who knows BMAD deserves the same short,
fair answer.

## What Changes

- `README.md` gains a section, `How this differs from BMAD`, beside
  `Why not just openspec view`. It says:
  - what BMAD is, in its own words, linked to its repository, and with
    the date that description was read;
  - what the two share;
  - where they differ, each difference as a fact about this repository,
    with a link to the document that establishes it;
  - that the two are not exclusive: planning done with BMAD can become an
    OpenSpec change here.

## Capabilities

### New Capabilities

(none — documentation only, no behavior change)

### Modified Capabilities

(none)

## Impact

- `README.md` only.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- Any claim about BMAD that its own published pages do not make. Where
  they are silent — on spending limits, audit logs, parallel runs — the
  section says what this repository does, and does not claim BMAD lacks
  it.
- A comparison table scoring either project, or a recommendation of one
  over the other.
- Adopting anything from BMAD.

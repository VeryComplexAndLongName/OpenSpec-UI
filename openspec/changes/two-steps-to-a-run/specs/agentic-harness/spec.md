## ADDED Requirements

### Requirement: A common configuration goal has a short path

A goal a person configures the harness for SHALL have a document that
states the goal, the file it edits, at most two steps, and the object
those steps write — linking the reference documentation for accepted
values rather than restating them.

Reference documentation organised by configuration key answers "what
does this key accept". It does not answer "what do I set to get this
outcome", and a person assembling that answer out of four keys in a
reference is the cost that grows with every setting added.

A goal that cannot be expressed in two steps SHALL be recorded as such,
naming what stands in the way, rather than written up as a longer path.
The length is evidence about the configuration, not about the document.

#### Scenario: A goal that fits in two steps

- **WHEN** a common goal can be reached by editing one file in at most
  two steps
- **THEN** a document states the goal, that file, those steps and the
  object written, and links the reference for the detail

#### Scenario: A goal that does not fit

- **WHEN** a common goal cannot be reached in two steps
- **THEN** the goal and the obstacle are recorded, and no page is
  written that pads the path to make it fit

### Requirement: What a CLI cannot be given is stated with its reason

Where an agent's own CLI cannot accept a configuration this harness
offers for other agents, the documentation of that configuration SHALL
say so, with the date the CLI's published behaviour was read and the
mechanism that CLI uses instead.

"Unsupported" alone invites the same question to be asked and
re-derived. A statement that names what the CLI does document — a
directory it reads, a selection syntax it accepts — is what lets a
future reader tell whether the situation has changed.

#### Scenario: An agent's CLI has no flag for a capability offered to others

- **WHEN** an agent's CLI reads custom agent definitions but documents
  no flag selecting one for a single non-interactive run
- **THEN** the documentation states the directories it reads, the
  selection mechanism it does document, the date read, and that this is
  why no custom agent can be offered for it

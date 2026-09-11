## ADDED Requirements

### Requirement: Streamed text is shown as the prose it was written as

Where an agent streams a reply as a run of updates each carrying a
slice of text, the surface SHALL join those slices and show one piece
of prose.

A slice is cut wherever the agent happened to flush, which is routinely
mid-sentence and sometimes mid-word. Rendering each slice as its own
element shows the reader the transport rather than the answer.

Slices SHALL join with nothing inserted between them. A slice is not a
line, and a separator placed between two of them breaks a word.

Only slices of the same kind SHALL join. Text an agent offers as its
message and text it offers as its thinking are different statements,
and running them together shows one that was never made.

An update carrying anything other than streamed text SHALL NOT join,
and SHALL end the run of slices around it. A tool call that happened
between two sentences happened between them, and the transcript SHALL
say so.

An update whose shape is not recognised as streamed text SHALL be left
exactly as it is. The payload is carried verbatim from a protocol this
system does not own, and guessing at an unfamiliar shape turns an
addition to that protocol into mangled output.

#### Scenario: A reply arriving in slices

- **WHEN** an agent streams a reply as several text updates, one of
  which ends mid-word
- **THEN** the surface shows one piece of text, with no break inside
  the word

#### Scenario: Thinking and speaking

- **WHEN** text offered as thinking arrives beside text offered as a
  message
- **THEN** they are shown as two pieces, not one

#### Scenario: A tool call between sentences

- **WHEN** a tool call arrives between two text updates
- **THEN** three things are shown, in the order they happened

#### Scenario: An update of an unfamiliar shape

- **WHEN** an update carries a kind this system does not recognise
- **THEN** it is shown as it is, and joins nothing

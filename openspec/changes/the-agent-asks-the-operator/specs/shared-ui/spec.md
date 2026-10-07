## ADDED Requirements

### Requirement: Open questions are answered where they are shown

A change's card SHALL list each open question from its `decisions.md`
under "Waiting on you", with a field for the answer and **Answer**. The AI
panel SHALL do the same for the run it shows. The Human-Only Inbox SHALL
list open questions beside Human-only items and answer them the same way.
An answer given in a host where the waiting run is not SHALL reach that
run.

#### Scenario: Answering from the card

- **WHEN** a change's review waits on a question and the operator types an
  answer on its card and presses **Answer**
- **THEN** the answer is in `decisions.md`, and the waiting run goes on

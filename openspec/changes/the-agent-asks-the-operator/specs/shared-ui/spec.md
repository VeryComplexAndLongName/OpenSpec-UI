## ADDED Requirements

### Requirement: Open questions are answered where they are shown

A change's card SHALL offer to answer each open question from its
`decisions.md`, with a field for each answer and **Answer**, whether or not
the run that asked is alive. The AI panel SHALL do the same for the run it
shows. The Human-Only Inbox SHALL list open questions, from the checkout's
changes and from each change's own worktree, beside Human-only items and
answer them. An answer given in a host where the waiting run is not SHALL
reach that run.

#### Scenario: Answering from the card

- **WHEN** a change's review waits on a question and the operator types an
  answer on its card and presses **Answer**
- **THEN** the answer is in `decisions.md`, and the waiting run goes on

## ADDED Requirements

### Requirement: The Changes list says whose each change is

The Changes list SHALL say, for each active change, whether it is worked in
this working directory, in another one - named, and with the person where a
verified record names one - or by nobody, using the sentence
`packages/core` gives for that answer.

A change worked in another working directory SHALL be visibly distinct
from one this directory owns, and SHALL NOT be presented as ready to act
on.

#### Scenario: A change worked in another directory

- **WHEN** the list is drawn in a checkout where another working directory
  is a change's worktree
- **THEN** that change says where it is worked and who is working it, and
  is drawn distinctly from this directory's own change

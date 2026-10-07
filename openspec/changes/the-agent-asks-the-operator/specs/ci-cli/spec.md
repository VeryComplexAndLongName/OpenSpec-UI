## ADDED Requirements

### Requirement: The CLI answers a question

`openspec-ui-cli answer <change> <question-id> <text> [--cwd <path>]` SHALL
answer the question, writing `decisions.md` and the audit log and reaching
a run that waits on it. `openspec-ui-cli status` SHALL list a change's open
questions with their ids.

#### Scenario: From a terminal

- **WHEN** `openspec-ui-cli answer demo Q-r1-1 "Active contacts only"` runs
- **THEN** `decisions.md` of `demo` holds that answer, and a run waiting on
  `Q-r1-1` goes on

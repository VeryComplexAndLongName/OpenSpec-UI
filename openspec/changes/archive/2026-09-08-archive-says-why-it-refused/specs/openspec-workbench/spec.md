## ADDED Requirements

### Requirement: A refused archive states the reason the tool gave

Where archiving a change is refused, the reason SHALL be reported as the
underlying tool stated it — naming the requirement or scenario at fault
where the tool named one.

The tool refuses precisely, and the refusal is the information a person
needs in order to act: which requirement drifted, which scenario would
have been dropped. Reporting only that the archive did not happen sends
the reader to run the command themselves to learn what the system already
knows.

Where the refusal carries more than one problem, all of them SHALL be
reported. Reporting the first sends the reader back round the loop for
the second.

Where no reason can be recovered, the report SHALL say that, rather than
presenting a runtime warning or an unparsed payload as the explanation.

#### Scenario: A stale spec delta is refused

- **WHEN** archiving is refused because a modified block no longer
  matches the specification
- **THEN** the reported reason names the requirement or scenario at fault

#### Scenario: Several problems at once

- **WHEN** a refusal carries more than one error
- **THEN** every one of them is reported

#### Scenario: Nothing usable was produced

- **WHEN** archiving fails with no recoverable reason
- **THEN** the report says no reason was given, rather than showing
  unrelated output as one

#### Scenario: Archiving succeeds

- **WHEN** a change archives normally
- **THEN** nothing about this reporting changes

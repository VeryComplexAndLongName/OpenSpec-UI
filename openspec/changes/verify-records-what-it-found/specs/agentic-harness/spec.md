## ADDED Requirements

### Requirement: What verify's checks found is recorded

Where `verify` runs a change's declared mechanical checks, their outcome
SHALL be recorded in the audit log: how many ran and how many failed.

This is the only machine-produced statement about the quality of what an
earlier stage produced, and it is computed already. Discarding it leaves
the record able to say what a run cost and unable to say whether the work
was any good.

It SHALL be recorded whether or not the verifying agent runs. A `verify`
whose checks failed does not invoke the agent, so no run entry is written
for it — leaving the case that found the most as the one that left no
trace.

Where a change declares no checks, nothing SHALL be recorded. An entry
saying nothing ran is indistinguishable from one saying nothing failed.

#### Scenario: Checks that all pass

- **WHEN** `verify` runs declared checks and all of them pass
- **THEN** the record says how many ran and that none failed

#### Scenario: Checks that fail

- **WHEN** a declared check fails and the verifying agent is not invoked
- **THEN** the record still says how many ran and how many failed, and
  names the failures

#### Scenario: A change declaring no checks

- **WHEN** a change declares no mechanical checks
- **THEN** nothing is recorded for them

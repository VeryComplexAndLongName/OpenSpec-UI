## ADDED Requirements

### Requirement: A template's configuration matches what it says it does

A template's stated behaviour SHALL be reflected in the configuration it
applies.

A template's sentences are its interface: they are what a person reads
before applying it, and what they will hold it to afterwards. A sentence
that is not true is the same defect as a ceiling that cannot act, and it
is harder to notice — the configuration has to be read to see it.

Where a stated behaviour names a specific setting, the templates SHALL be
checked against it mechanically.

#### Scenario: An unattended template does not pause between stages

- **WHEN** a template describes running without stopping for anyone
- **THEN** the configuration it applies turns off confirmation between
  stages, rather than leaving it inherited

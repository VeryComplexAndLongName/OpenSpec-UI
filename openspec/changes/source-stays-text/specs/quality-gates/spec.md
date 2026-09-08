## ADDED Requirements

### Requirement: Tracked source files carry no raw control bytes

A tracked source file SHALL NOT contain a raw control byte. A control
character intended as a value SHALL be written as an escape sequence.

A file carrying one is classified as binary by `grep` and by the tools
built on it, so it silently drops out of every search across the
codebase — the file returns nothing for a term it contains, and a search
that should have found it reports a match it cannot show. A file nobody's
search can reach is a file nobody reviews.

#### Scenario: A source file with a raw control byte

- **WHEN** a tracked source file contains a byte below 0x09, or between
  0x0E and 0x1F
- **THEN** the check fails, naming the file and the offset

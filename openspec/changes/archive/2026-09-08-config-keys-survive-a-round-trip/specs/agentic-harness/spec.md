## ADDED Requirements

### Requirement: A setting the configuration accepts is one the resolved configuration carries

Every top-level key a harness configuration file accepts SHALL survive
being written and read back, and SHALL survive a per-change file being
merged over a global one.

A key that passes validation and is then discarded produces no error at
the seam: the file is correct, the write succeeds, the read returns a
valid configuration, and a setting simply does nothing. That has already
happened here to two settings at once.

The check SHALL fail when a key is added to the accepted set without
being exercised, so that it cannot decay into a list of the keys someone
remembered — which is exactly what the reader that dropped them already
was.

#### Scenario: A configured key is read back

- **WHEN** a configuration setting any accepted top-level key is written
  and read
- **THEN** the resolved configuration carries that key's value

#### Scenario: A key set only per change

- **WHEN** a per-change configuration sets a key the global one does not
- **THEN** the merged configuration carries it

#### Scenario: A key is added without being exercised

- **WHEN** the accepted set gains a key that the check has no value for
- **THEN** the check fails, naming that key

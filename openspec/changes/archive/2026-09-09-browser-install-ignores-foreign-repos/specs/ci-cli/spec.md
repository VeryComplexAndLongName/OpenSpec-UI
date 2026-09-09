## ADDED Requirements

### Requirement: The browser suite does not depend on apt sources it never reads

Installing the browser suite's system dependencies SHALL NOT fail
because of an apt source this repository installs nothing from.

The runner image carries third-party sources; `--with-deps` reads all of
them through `apt-get update`, so a bad publish anywhere on the image
fails an install that has nothing to do with it. Observed three times
across half an hour on 2026-09-09, all from Google's Chrome repository,
which this job never installs a package from.

The system dependencies themselves SHALL still be installed. The source
is what is removed, never the check that the libraries Chromium needs
are present.

#### Scenario: A third-party repository failing to publish

- **WHEN** an apt source on the runner image serves an index that does
  not match its hashes
- **THEN** the browser install still succeeds, because that source is
  not read

#### Scenario: The dependencies Chromium needs

- **WHEN** the browser is installed in CI
- **THEN** its system dependencies are installed with it

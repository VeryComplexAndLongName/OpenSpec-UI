## ADDED Requirements

### Requirement: Enrolment can be listed and confirmed from the terminal

The CLI SHALL list every enrolment request, with the facts a person needs to
decide, and SHALL confirm a request named by its key identifier.

`status` SHALL state, for each run, whether its record is verified,
unverified, or does not check out.

#### Scenario: Listing and confirming

- **WHEN** `enrol` is run, and then run again naming a listed key
- **THEN** the first run lists the request, and the second enrols the key

#### Scenario: Status after enrolment

- **WHEN** `status` is read after a key is enrolled
- **THEN** that key's runs are described as signed by the enrolled person,
  verified

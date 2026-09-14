## ADDED Requirements

### Requirement: A surveyed run says whose it is, as far as its signature shows

For each run, the survey SHALL state whether the run's record is verified,
unverified, or does not check out.

A verified run SHALL be described as signed by the enrolled person, and
nothing more SHALL be claimed about the run itself.

A run whose record does not check out SHALL be described as such, with
nothing from its contents.

#### Scenario: A verified run

- **WHEN** a run's record is verified
- **THEN** the survey says the run is signed by the enrolled person

#### Scenario: A record that does not check out

- **WHEN** a run's record does not check out
- **THEN** the survey says so, and shows no activity for that run

### Requirement: An enrolment request waits where items wait on a person

The standalone shell SHALL show each enrolment request beside the items that
wait on a person, with its label, working directory, machine, git author and
time. It SHALL offer one action that confirms the person started the run.

#### Scenario: A request in the shell

- **WHEN** a key awaits enrolment
- **THEN** the shell's inbox shows the request with those facts, and one
  action confirms it

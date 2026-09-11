# repo-bootstrap-snippets Specification

## Purpose
TBD - created by archiving change repo-bootstrap-snippets. Update Purpose after archive.
## Requirements
### Requirement: Agent instructions are generated identically into CLAUDE.md and AGENTS.md

The system SHALL let the user generate a project-type-specific
instructions block, written identically into both `CLAUDE.md` and
`AGENTS.md` at the workspace root, delimited by managed-section markers.
If either file already exists without matching markers, the system
SHALL NOT modify that file and SHALL report it as not managed.

#### Scenario: Neither file exists yet

- **WHEN** the user generates agent instructions for a project type and
  neither `CLAUDE.md` nor `AGENTS.md` exists
- **THEN** both files are created with identical managed-section content

#### Scenario: A file already exists without the managed-section markers

- **WHEN** `CLAUDE.md` already exists and does not contain the managed-
  section markers
- **THEN** `CLAUDE.md` is left unmodified and the system reports it as
  not managed, while `AGENTS.md` (if unmanaged or absent) is still
  handled independently

#### Scenario: Regenerating an already-managed file preserves content outside the markers

- **WHEN** the user regenerates agent instructions for a file that
  already has the managed-section markers, with user-authored content
  after the closing marker
- **THEN** only the content between the markers is replaced; content
  before the start marker and after the end marker is preserved verbatim

### Requirement: Dependabot configuration accumulates ecosystems across invocations

The system SHALL let the user generate or update `.github/dependabot.yml`
for one or more selected project types, using a first-line ownership
marker. Invoking it again for a different project type SHALL add that
ecosystem without removing ecosystems added by a prior invocation. A
`dependabot.yml` that exists without the ownership marker SHALL NOT be
modified.

#### Scenario: First invocation creates the file

- **WHEN** `.github/dependabot.yml` does not exist and the user selects
  a project type
- **THEN** the file is created with that ecosystem's entry, the
  ownership marker, and a `github-actions` entry

#### Scenario: A later invocation adds another ecosystem

- **WHEN** the file already exists (managed) with one ecosystem's entry
  and the user selects a different project type
- **THEN** the regenerated file contains both ecosystems' entries

#### Scenario: An unmanaged dependabot.yml is left alone

- **WHEN** `.github/dependabot.yml` exists without the ownership marker
- **THEN** the system makes no change and reports the file as not
  managed

### Requirement: Path-scoped Copilot instructions are generated per subtype

The system SHALL let the user generate
`.github/instructions/<subtype>.instructions.md` for a selected project
type and subtype, with `applyTo` frontmatter and managed-section content,
using the same file-ownership rule as `CLAUDE.md`/`AGENTS.md`.

#### Scenario: Generating instructions for a subtype

- **WHEN** the user selects a project type and a subtype
- **THEN** `.github/instructions/<subtype>.instructions.md` is created
  with `applyTo` frontmatter and the subtype's managed content

### Requirement: A setup action is offered only where it can do something

The repository setup list SHALL offer an action only where the thing
that action configures could act on this repository, on this machine.

An action that writes a file no installed component and no host service
reads produces something inert, and worse than inert once committed: it
states that a thing is configured when nothing will act on it.

An action whose applicability does not depend on anything SHALL remain
offered unconditionally.

#### Scenario: An action whose component is absent

- **WHEN** the setup list is shown and an action's component is not
  present
- **THEN** that action is not listed

#### Scenario: An action that always applies

- **WHEN** the setup list is shown
- **THEN** an action that configures plain files, which any tool may
  read, is listed regardless

### Requirement: What decides an action differs by what the action configures

Applicability SHALL be decided from the kind of thing being configured,
not from one rule applied to all of them.

Where the action configures a service run by the repository's host, the
deciding fact SHALL be where the repository is hosted. Nothing is
installed for such a service, so no local inspection can answer it.

Where the action configures a component installed on the machine, the
deciding fact SHALL be whether that component is present.

#### Scenario: A host service

- **WHEN** the action configures a service the repository's host runs
- **THEN** it is offered according to where the repository is hosted

#### Scenario: An installed component

- **WHEN** the action configures a component installed on the machine
- **THEN** it is offered according to whether that component is present

### Requirement: Not knowing is not knowing that it is absent

Where the check itself cannot be completed, the action SHALL be offered.

Hiding an action because the inspection failed removes a working
capability from somebody whose setup could not be examined, and leaves
them no way to discover it. The cost of the opposite mistake is one
extra entry. An action SHALL be withheld only on a definite negative.

#### Scenario: The check cannot run

- **WHEN** determining whether an action applies fails
- **THEN** the action is listed

### Requirement: An action that is not listed is still reachable

Every setup action SHALL remain invocable by name whether or not it is
listed.

Invoking one that does not apply SHALL say what was established and
what was not, and SHALL offer to carry it out anyway.

A capability that exists nowhere cannot be discovered, and no
inspection is certain enough to refuse a person who knows their own
setup better than it does.

#### Scenario: Invoking a hidden action

- **WHEN** an action that is not listed is invoked by name
- **THEN** it explains why it is not listed and offers to proceed

#### Scenario: Proceeding anyway

- **WHEN** a person chooses to proceed with an action that was not
  listed
- **THEN** it does exactly what it would have done had it been listed

### Requirement: Deciding does not cost a process on every refresh

Determining what applies SHALL happen when the setup list is opened, and
its result SHALL be reused for the session.

The tree is rebuilt whenever the workspace changes. A check that spawns
a process would make an unrelated edit spawn one.

#### Scenario: Refreshing the tree

- **WHEN** the tree is rebuilt after a file changes
- **THEN** no additional process is started to decide what to offer


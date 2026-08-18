## ADDED Requirements

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

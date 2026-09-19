## ADDED Requirements

### Requirement: Publishing to the Marketplace is asked for, never inferred

The repository SHALL be able to publish a released version of
`openspec-ui-vscode` to the Visual Studio Marketplace, and SHALL do so
only when a person dispatches that publish and names the version.

No push, tag, schedule or merge SHALL start a publish. Not every release
is meant for the Marketplace, and a publish reaches every installed copy
through the editor's auto-update and cannot be taken back.

The dispatch SHALL require a confirmation the person types, and the run
SHALL refuse anything else before it reads the token.

What is published SHALL be the artifact that was released: the `.vsix`
attached to the `openspec-ui-vscode@<version>` tag's GitHub Release, which
the extension integration suite exercised. The publish SHALL NOT rebuild
the extension, and SHALL fail, naming the tag, where that release or that
asset is absent.

The Marketplace token SHALL be held as a repository secret read by the
publishing job alone, and SHALL NOT appear in any other workflow, in any
document or in any run's output.

A check SHALL fail the lint gate where the publishing workflow stops
holding to this: another trigger, a missing confirmation, a rebuild in
place of the released artifact, or a second workflow naming the token.
These guarantees live in a YAML file that no test would otherwise read.

#### Scenario: A release that is not meant for the Marketplace

- **WHEN** a version is released, tagged and published as a GitHub Release
- **THEN** nothing reaches the Marketplace until a person dispatches the
  publish for that version

#### Scenario: A dispatch without the confirmation

- **WHEN** the publish is dispatched with anything but the required word
  typed into the confirmation
- **THEN** the run fails before the token is read and nothing is published

#### Scenario: A version that was never released

- **WHEN** the publish is dispatched for a version whose tag has no release
  or whose release carries no `.vsix`
- **THEN** the run fails naming the tag, rather than building a package of
  its own

#### Scenario: A trigger added to the publishing workflow

- **WHEN** the publishing workflow gains a trigger other than the manual
  dispatch, loses its confirmation, or a second workflow names the token
- **THEN** the lint gate fails

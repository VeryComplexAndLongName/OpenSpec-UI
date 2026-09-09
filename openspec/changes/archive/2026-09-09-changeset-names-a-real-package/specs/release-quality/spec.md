## ADDED Requirements

### Requirement: A changeset names a package the workspace has

A changeset naming a package that is not in the workspace SHALL fail the
repository's ordinary checks.

The release tooling already refuses such a name, but it runs only after
the merge — the job that versions pending changesets has nothing to do on
a pull request and is skipped there. A name that is wrong is therefore
found on `main`, and every subsequent merge repeats the failure until
someone reads the run.

The list of known packages SHALL be read from the workspace rather than
written down beside the check. A written list is a second place to forget
a package, which is the mistake being prevented.

#### Scenario: A changeset naming a directory rather than a package

- **WHEN** a changeset names `@openspec-ui/extension`, whose package is
  called `openspec-ui-vscode`
- **THEN** the checks fail, naming the file and the unknown package, and
  listing what the workspace does have

#### Scenario: A changeset naming every package correctly

- **WHEN** every name in every changeset resolves to a workspace package
- **THEN** the check passes

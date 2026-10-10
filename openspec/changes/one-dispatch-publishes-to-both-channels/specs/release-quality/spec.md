## ADDED Requirements

### Requirement: Publishing to npm is asked for, never inferred

The repository SHALL be able to publish a version of `@openspec-ui/cli` to
the npm registry, and SHALL do so only when a person dispatches that
publish and names the version. The same dispatch SHALL be able to publish
`openspec-ui-vscode` to the Marketplace, each channel at the version named
for it, and a channel whose version is not named SHALL be skipped.

No push, tag, schedule or merge SHALL start an npm publish. The dispatch
SHALL require the typed confirmation described for the Marketplace, and
both publishing jobs SHALL wait for it, so that neither reads a credential
before the confirmation has been checked.

The publish SHALL be refused unless the dispatch was started from `main`,
the version named is the version `packages/cli/package.json` states on
that commit, and that version is not already on the registry. What is
published SHALL be the bundle built in that run.

npm SHALL be authenticated by Trusted Publishing: the registry trusts the
publishing workflow and its environment, and no npm token SHALL exist in
a repository secret, in any workflow or in any document. The OIDC
permission the registry exchanges SHALL be granted to the npm job alone.
The repository's pinned npm SHALL install and build; a newer, exactly
named npm MAY be installed for the publish step alone.

A check SHALL fail the lint gate where the publishing workflow stops
holding to this: another trigger, a missing confirmation, a publishing job
that does not wait for it, an npm job outside its environment, an npm
token, or a second workflow publishing to npm.

#### Scenario: A CLI version is merged

- **WHEN** a version of `@openspec-ui/cli` is merged to `main`
- **THEN** nothing reaches npm until a person dispatches the publish for
  that version

#### Scenario: One dispatch names only one channel

- **WHEN** the publish is dispatched with `cli_version` and no
  `vscode_version`
- **THEN** `@openspec-ui/cli` is published and the Marketplace job is
  skipped

#### Scenario: A version that this commit does not carry

- **WHEN** the publish is dispatched for a `cli_version` other than the
  one `packages/cli/package.json` states, or for one already on npm
- **THEN** the run fails naming both versions, and nothing is published

#### Scenario: A dispatch from another branch

- **WHEN** the publish is dispatched from a ref other than `main`
- **THEN** the npm job fails before it builds or publishes

#### Scenario: An npm token or a second path appears

- **WHEN** a workflow names an npm token, or a workflow other than the
  publishing one runs `npm publish`
- **THEN** the lint gate fails

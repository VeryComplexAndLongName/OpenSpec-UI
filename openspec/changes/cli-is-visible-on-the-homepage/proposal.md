# Proposal

## Why

ADR-0009 makes `@openspec-ui/cli` an installable npm product, but the release
manifest marks `ci-cli` as non-public. The official homepage therefore omits
its version from both Current versions and Current releases.

## What Changes

- Mark the existing `ci-cli` product public, preserving its identity and version source.
- Add a CLI summary and optional `links.npm`, pointing to
  `https://www.npmjs.com/package/@openspec-ui/cli`; no other product gets an npm link.
- Retain manifest schema version 1: the new link is optional and additive.
- Deliver the updated manifest through the existing release path and signed webhook.
- Coordinate with `OpenSpec-UI-Homepage` change `cli-is-visible-on-the-homepage`,
  which renders the fourth tile/card and its npm button in the existing style.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-quality`: the published manifest exposes CLI as public and supplies its npm destination.

## Impact

`packages/cli/src/release-manifest.ts`, its existing tests, and CLI documentation.
A minor changeset for `@openspec-ui/cli` is required at implementation time.
No GitHub CLI release, tarball, new CI publishing job, npm authentication fix,
or core command/event change is included. No architecture invariant changes;
ADR-0009 and ADR-0048 remain in force. This entry is planning only.

# Proposal

## Why

Core is an internal library, but the release manifest currently marks it
public. The homepage already filters products by the manifest's `public` flag,
so this exposes an internal package beside the three user-facing products.
Changing the flag alone is not enough: the current publication fingerprint
contains only product ids and versions, so CI would treat the visibility change
as no release and leave the homepage unchanged.

## What Changes

- Mark Core non-public while preserving its stable product id and complete
  manifest record for internal release tracking.
- Include each product's public state in the manifest fingerprint so a
  visibility-only change is published through the existing release path.
- Keep the manifest schema and product ids unchanged; the homepage needs no
  code change because it already filters `public_products`.
- Add a CLI minor changeset for the changed fingerprint output contract.

## Capabilities

### Modified Capabilities

- `release-quality`: only Extension, Standalone App and CLI are public; Core
  and Shared UI remain in the manifest but are not presented by the homepage.
- `release-quality`: visibility changes alter the fingerprint used by CI to
  decide whether to publish a new manifest.

## Impact

`packages/cli/src/release-manifest.ts`, its tests and CLI fingerprint
documentation, `openspec/specs/release-quality/spec.md`, and a CLI changeset.
No homepage schema, schema version, package version, or GitHub release is
changed directly.
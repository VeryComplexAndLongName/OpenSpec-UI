# Design

## Decision

Keep all five stable product records in `releases.json`. Set the `core`
product's existing `public` field to `false`; the homepage's `public_products`
view already omits it. Leave versions, links, release metadata and schema
version unchanged.

The CI publication gate compares a fingerprint generated from the new and
published manifests. Extend that fingerprint with the public/private state of
each product. A change to visibility then produces a different fingerprint
even when no package version changes, while `generated_at` and `commit` remain
excluded. The fingerprint remains a deterministic, sorted string and is still
compared as an opaque value by the workflow.

## Compatibility

The manifest remains schema version 1 and retains every product id. The
fingerprint is consumed by this repository's release workflow, not by the
homepage. Update the CLI help and README to describe the visibility-aware
fingerprint. The homepage requires no migration or code change.

## Release

The CLI's documented `--fingerprint` output changes, so provide a minor
changeset for `@openspec-ui/cli`. Do not bump Core: its package API and version
are unaffected. CI will publish the updated manifest when the new fingerprint
differs from the published one.
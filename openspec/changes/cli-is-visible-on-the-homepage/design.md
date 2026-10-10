# Design

## Context

`MANIFEST_PRODUCTS` already includes `ci-cli`, but with `public: false`.
The homepage renders both sections from `manifest.public_products`. Its
reference schema is `OpenSpec-UI-Homepage/app/schemas/manifest.py`.

## Goals

Expose the CLI's package version, notes and npm destination to the site,
without altering the other four product identities or npm publishing.

## Non-Goals

GitHub CLI releases, download artifacts, a second CLI button, npm links for
private packages, implementation during proposal creation, and site deployment.

## Decisions

1. Preserve `ci-cli`; set `public: true` and a concise English summary.
   Rejected: rename it to `cli`, which would split recorded release history.
2. Extend `ProductLinks` with optional `npm?: string`. Populate it only for
   `ci-cli` with the package page URL above. The consumer adds the matching
   optional field before production rollout. Keep `schema_version` at 1.
   Rejected: use `marketplace` for npm, which confuses two distinct destinations;
   rejected: version 2, which would make old consumers reject an additive change.
3. Keep the existing version fingerprint and webhook. The CLI minor changeset
   ensures that the merged version commit changes the fingerprint and publishes
   the visibility/link update. Do not claim that editing metadata alone triggers
   publication. If rollout occurs before a version bump, it remains outstanding.
   Rejected: widen fingerprint semantics for this one addition.
4. Versions still mean the version carried by the repository, not confirmed npm
   registry availability. The npm button links to the package page, not an invented
   version-specific artifact. npm publishing remains separately dispatched.

## Risks / Trade-offs

- An old homepage accepts but ignores `links.npm`; deploy its companion first.
- Until a version bump publishes a manifest and the site syncs, CLI stays hidden.
- A package version can precede npm publication; the card must not claim otherwise.
- All five products remain in the manifest; only Shared UI remains non-public.

## Compatibility and Verification

No core commands/events or server/webui/extension protocols change, so their
contract-test updates are not needed. Test public flags, stable identities,
CLI-only npm links, schema version, and serialization in the existing CLI suite.
Then validate a generated manifest with the homepage schema and verify the
signed-webhook/scheduled-sync rollout without dispatching an npm publication.

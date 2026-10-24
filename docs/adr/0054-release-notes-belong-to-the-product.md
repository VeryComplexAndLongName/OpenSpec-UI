# ADR 0054: Release notes belong to the product a person uses

Status: Accepted

Date: 2026-10-24

## Context

Core 0.150.0 announced Codex CLI and ACP as working agents, but Extension
0.106.3 and Standalone 1.62.3 only listed dependency updates. The website
correctly hides Core as a product and drops dependency bookkeeping, so the
feature disappeared at the public product boundary. GitHub's PR list did
not provide a clear announcement either.

## Decision

1. Every new OpenSpec proposal carries a concise Changelog section, naming
   affected public deliveries. Its copy feeds Changesets entries for those
   packages, even when the code lives in Core. Internal product visibility
   and the release-manifest schema remain unchanged.
2. Use one to three bullets, one or two sentences per bullet, at most 80
   words per changeset body. State the behavior and essential scope or
   requirement. Review accuracy and audience; lint length and placeholders.
3. Keep complete wrapped summaries. GitHub Highlights come from the same
   version-matched product changelog as the website manifest, before the
   generated PR history. Validate notes in the version PR and before tags.
4. Missing authored public notes block publication. Maintenance releases
   describe the actual maintenance outcome rather than inventing features.
5. Historical copy corrections preserve introduction versions, commit and
   dependency references, tags, assets and prior release history. New
   publication/tooling work still carries an ordinary changeset.

## Rejected Alternatives

- Public Core: exposes an internal package rather than describing the app.
- Dependency-only release notes: hide meaningful delivered behavior.
- Copying every private note automatically: misattributes internal work or
  capabilities to products that do not expose them.
- Truncation or generic fallback copy: discards meaning or invents an outcome.

## Consequences

Authors identify product audiences explicitly. Existing delivery/version
mechanisms stay in place; Marketplace and npm publication remain dispatched.
Editorial judgment remains necessary despite mechanical guardrails.

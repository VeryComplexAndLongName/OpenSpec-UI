## ADDED Requirements

### Requirement: A change explains what each product user receives

Every new OpenSpec proposal SHALL contain a Changelog section naming the
affected public deliveries and one to three concrete bullets. Changesets
SHALL name those delivery packages even when implementation is in Core or
Shared UI. Copy SHALL explain observable behavior and essential limits in
one or two sentences per bullet, with at most 80 words per changeset body.
An internal-only change SHALL state why no public behavior changes; a
versioned public product still needs an accurate maintenance note.

#### Scenario: Core adds a shared agent capability

- **WHEN** a Core change makes Codex a working agent in Extension, Standalone and CLI
- **THEN** those public packages receive authored capability notes through Changesets
- **AND** users do not have to find Core's private changelog to learn the feature

#### Scenario: A changeset contains only a placeholder or excessive prose

- **WHEN** a named changeset is empty, says only Updated dependencies, or exceeds 80 words
- **THEN** the existing changeset check fails with the file and the correction needed
- **AND** an intentionally empty changeset with no named packages remains valid

### Requirement: Release highlights preserve complete product copy

Manifest summaries SHALL preserve wrapped changelog text while excluding
dependency-only bookkeeping and its package lists. GitHub releases SHALL
lead with version-matched authored product Highlights and retain generated
history after them. The version PR SHALL validate public-product notes,
and the release job SHALL generate its notes before creating a tag.

#### Scenario: A useful note wraps onto another source line

- **WHEN** a changelog bullet spans multiple lines
- **THEN** both the manifest and GitHub Highlights retain its complete meaning
- **AND** nested dependency lists do not become product features

#### Scenario: A version has no authored product note

- **WHEN** a public product has only dependency bookkeeping or mismatched-version notes
- **THEN** pre-publication validation fails rather than publishing invented highlights

#### Scenario: Previously shipped Codex support was not visible

- **WHEN** the released Codex notes are corrected
- **THEN** product changelogs and GitHub Highlights identify CLI and ACP support with its original introduction version
- **AND** versions, original history, tags and released assets are preserved

# Proposal

## Why

`openspec/README.md`, under "Editorial content is not a change", requires
that a claim about the product — a version, a count of templates, a
capability — cite the file or spec it came from. The rule was added by
`an-article-is-editorial-not-a-change` (2026-09-20) after `README.md`
carried a wrong template count for three weeks, so that a reader who cannot
check an article against the tree could still check a claim.

In practice the obligation became a fixed `## Where each claim comes from`
section repeated verbatim across every venue. The owner has asked the
publishing agent to stop writing it, so the requirement it serves must go
rather than be silently ignored.

## What Changes

- Remove the editorial bullet in `openspec/README.md` that says a claim
  about the product cites where it comes from. The rest of the editorial
  section stays: `docs/articles/**` is still exempt from OpenSpec changes,
  still English-only, its pictures still live beside it, and an editorial
  pull request is still titled `article: <slug>`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none - process documentation only)

## Impact

- `openspec/README.md` only. No `packages/*` change, no changeset, and no
  change to `scripts/check-articles.mjs`, which never checked for the
  section — it verifies only that pictures exist and are where they belong.

## Explicitly out of scope

- Deleting the section from articles already published. Those stay as
  written; this change lifts the requirement for future articles only.
- Any other editorial rule: English-only, pictures beside the article,
  no SVG, and the one-piece-of-work-per-pull-request branch rule all stay
  in force.

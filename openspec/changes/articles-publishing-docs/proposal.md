## Why

Raised directly in a repository conversation on 2026-10-02: `docs/articles/`
has grown a publishing model — a canonical article under `docs/articles/site/`,
a per-venue copy or teaser everywhere else, a CI dispatch that tells a
separate homepage repository when the canonical article changed — that is
nowhere written down. Anyone picking up an article task (including an agent)
has to reconstruct it by reading the directory layout, the frontmatter of a
few files, and `.github/workflows/homepage-dispatch.yml`. This is a
documentation-only change: no behavior changes, and per this repository's own
convention (`openspec/changes/archive/2026-08-31-agentic-harness-usage-docs/`),
a pure-docs change skips the specs-delta requirement (`skip_specs: true`).

## What Changes

- New `docs/articles/README.md`: the publishing model in one place — what
  `docs/articles/site/` is and who reads it (the `OpenSpec-UI-Homepage`
  repository, which publishes to `openspec-ui.dev` and mirrors to dev.to
  itself), what every other venue folder is (a manually-published copy or
  teaser that must link back to the site article), what
  `homepage-dispatch.yml` does and when it fires, and the existing
  `docs/articles/` exemption from the OpenSpec-change-per-edit rule
  (`scripts/check-articles.mjs`'s own comment) plus what that script still
  enforces.
- `CLAUDE.md`: one pointer to `docs/articles/README.md` (pointers, not
  duplicates).
- `AGENTS.md`: one pointer to the same file, in the same style as its
  existing `HARNESS.md`/`LIMITS.md` pointer paragraph.
- No change to any spec, ADR, or code.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a documentation-only change)

## Impact

- `docs/articles/README.md` (new)
- `CLAUDE.md`
- `AGENTS.md`

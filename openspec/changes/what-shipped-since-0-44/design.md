# Design

## Decisions

**One article for the range, not one per change.** Twenty-eight archived
changes are not twenty-eight things a user got; they are about eight,
each arrived at over several changes. The article is organised by what a
person can now do.

Rejected: a per-release note generated from changesets. Changesets say
what changed in a package, which is the right granularity for a
maintainer deciding whether to upgrade and the wrong one for somebody
asking what this tool does now. That document already exists per package
as `CHANGELOG.md`, and duplicating it in prose would leave two records
of the same facts to drift.

Rejected: a page per capability in `docs/`. A reference organised by
capability is what `HARNESS.md` already is. A second one would compete
with it, and the one thing a reader gets from a dated article — "this is
what is new since the version I have" — would be lost.

**Each section names the one way in.** A capability described without
the command or screen that reaches it is an announcement, not
documentation. Every section ends with the exact command
(`openspec-ui-cli ready`), the exact VS Code command title
(**OpenSpec UI: Run This Delegated Item**), or the exact tab.

**Written from the archived changes, not from memory.** Each section
cites the change it came from, so a reader who wants the detail has the
`openspec/changes/archive/<id>/` entry, and so the author of the article
cannot describe a capability the repository does not have. This is the
same rule `a-date-is-one-day-in-every-source` applied to dates: the
source is named.

Rejected: writing it from the packages' `CHANGELOG.md`. Those entries
are one line each and several say only "internal"; the archived change
carries the reasoning that makes a capability explainable.

**The teaser is short and links the article.** The shape is set by
`docs/articles/2026-09-09-teaser-0.44.md`: a few lines that can be
posted somewhere, not a summary that has to be maintained in parallel.

## Non-Goals

- Restructuring `HARNESS.md` or `LIMITS.md`.
- Any new screenshot, or any change to how screenshots are produced.
- A marketing page, a site, or anything published outside this
  repository.
- Describing capabilities that are proposed and not yet archived —
  including the five changes proposed alongside this one.

## Risks / Trade-offs

**An article dates.** It states a range (0.44 → 0.50) in its title and
its file name, so it dates honestly rather than pretending to be current
forever. The cost is that the next release needs another one; the
alternative — a living "features" page — has to be corrected on every
change and is wrong between corrections.

**Prose can claim more than the build does.** Mitigated by citing the
archived change per section, and by a verification task that opens the
named command or screen for each claim. A claim whose source is named is
checkable; one written from memory is not.

**No protocol impact.** This change adds no command and no event, and
touches no adapter. Nothing in `packages/` is modified except a
`README.md` link.

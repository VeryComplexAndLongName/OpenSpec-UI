# What shipped since 0.44

## Why

The last thing written for a person who uses this tool rather than
builds it is `docs/articles/2026-09-09-what-a-run-tells-you-0.40-to-0.44.md`.
The extension is 0.50.2 and twenty-eight changes have been archived
since that article was written.

Raised in review on 2026-09-12: the new capabilities are not described
for a user anywhere. That is exactly true. They are described in
`HARNESS.md` and `LIMITS.md`, which are reference tables organised by
configuration key — the right shape for somebody who already knows the
feature exists and the wrong shape for somebody finding out that it
does. `openspec/specs/persistent-workbench-runs/spec.md` already
requires release documentation to treat package versions as
authoritative; nothing requires that a release be explained in the terms
of the person using it, and so it has not been.

What is missing is one document that says, in order: a change can be run
from a terminal; changes can run side by side in their own working
directories; a task can be handed to a named agent and then actually
run; a run can be scheduled; mechanical checks run before a verifying
agent is spent; a change can declare a step, and a blocker; who holds a
workspace can be asked.

## Capabilities

### New

- An article covering 0.44 → 0.50 in a user's terms: what each new
  capability is for, what it replaces, and the one command or screen it
  is reached from.
- A short teaser for the same release, following the shape
  `docs/articles/2026-09-09-teaser-0.44.md` already set.

### Modified

- `README.md`'s Status section points at the current article rather than
  leaving the most recent one to be found by directory listing.

## Out of scope

`HARNESS.md` and `LIMITS.md`. They are reference documents and they are
accurate; this change does not restructure them. Turning a common task
into a short path is `two-steps-to-a-run`, which is its own change.

Screenshots. Every picture this article wants already exists or is the
subject of `every-screenshot-is-taken-by-a-spec`; this change writes
prose against whatever is in `docs/images/` when it lands, and adds no
hand-taken picture of its own.

A changelog. `CHANGELOG.md` per package is generated from changesets and
is already correct. An article is not a second changelog: it says what a
capability is for, which a changeset entry deliberately does not.

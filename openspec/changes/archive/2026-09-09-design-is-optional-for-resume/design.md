# Design

## Decision: the proposing stage is done when the proposal and the tasks are

`design` leaves the condition. What stays is `proposal` and `tasks`,
which is enough to tell the two real cases apart:

- A change mid-proposal has no `tasks.md` yet, so `tasks` is not done and
  the chain still starts at `propose`.
- A change with a proposal and a task list, with or without a design, is
  proposed — and where it goes next is answered by the task checkboxes,
  as it already is.

## Rejected: treating `ready` as done

`ready` is the CLI's word for an artifact it could produce. Reading it as
"done" would make an unwritten `proposal.md` look finished too, which is
the one case this check exists for.

## Rejected: checking whether `design.md` exists on disk

The status output already says so — `existingOutputPaths` is empty for a
missing artifact. Reading the filesystem again beside a command that just
answered the same question is a second source to keep in agreement.

## Rejected: requiring a design when the change's schema declares one

`spec-driven` declares `design` for every change, and this repository
ships plenty without one. The declaration says the artifact is known, not
that it is required; the validator is what decides required, and it
accepts these.

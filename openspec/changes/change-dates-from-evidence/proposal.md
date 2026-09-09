# A change's dates come from evidence, and say which

## Why

Charts are coming, and the dates they would be drawn from are not all
the same kind of thing.

What exists today:

- `createdDate` — the earliest commit that added `proposal.md`. Measured,
  and it survives the rename `openspec archive` performs.
- `archivedDate` — parsed out of the `YYYY-MM-DD-<id>` folder name.

The second one is a convention, and a convention is exactly what a
person who did not read this repository's runbook will not follow. A
change archived by moving the directory by hand carries no date at all,
or carries the wrong one, and nothing says which happened.

Neither is a date for the work itself. When a change was proposed and
when it was archived say nothing about when anything was done, and the
gap between them is mostly waiting.

The evidence is already in the repository:

- `git log --diff-filter=A --follow` on `proposal.md` — when it first
  appeared anywhere, rename-proof.
- `git log --diff-filter=A` at the archive path — the commit that put it
  under `archive/`. Verified on `presets-by-effort`: created 12:28,
  archived 14:22 the same day, neither read from a folder name.
- `git blame` on `tasks.md`, which this repository already runs per task
  line: the first and last time a task was checked.
- `.openspec-ui/audit.jsonl`, which timestamps every run against a
  change directory. 24 changes carry runs; the log begins 2026-09-02, so
  it is a second source and not the first.

## Capabilities

### New

- A change carries the dates it can be dated by — proposed, first worked
  on, last worked on, archived — each with where it came from.

### Modified

- The archived date is read from the commit that archived it, and from
  the folder name only when there is no commit to read.

## Out of scope

The charts. This is the data they would need; drawing them is a separate
question about which chart answers what.

Writing a date into a file. A date a person types is a fifth thing to
keep in sync with four that are measured — and the one that will be
wrong, because nothing checks it.

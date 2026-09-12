# A working directory is disposable

## Why

`C:\Prog` used to hold repositories. It now holds seventeen entries, of
which eleven are repositories and the rest are working directories,
leftover copies, and a second clone of one project.

One of those entries comes from this tool: `defaultWorktreePath` puts a
change's directory beside the repository, as `<repo>.worktrees/<change>`
— one such container per repository. The others have no `.git` at all
and were made by something else. A new default will not tidy those, and
this change does not pretend otherwise.

While looking, two things turned up that make the location question the
smaller half of the problem.

A working directory's `.openspec-ui/` is gitignored, so `audit.jsonl` —
the run history every recommendation, timeline, cost figure and quality
rating is derived from — cannot leave by commit. And `git worktree
remove` without `--force` refuses uncommitted **tracked** work but does
not see ignored files. Measured in a throwaway repository: the ignored
log leaves the directory clean, removal exits `0`, the log is gone.

So the tool destroys its own evidence at the moment that evidence first
becomes interesting — when the work is finished.

That makes "where do these live" and "what has to leave one before it
goes" a single question. Answering only the first would be choosing
where to lose things.

## What Changes

- Working directories are created under **one root**, at
  `<root>/<repository>/<change>`: one directory in a person's workspace
  folder for every repository, instead of one beside each.
- The root is read from the environment and a **user-level** file, never
  from `openspec/config.yaml` — one person's disk layout is not a fact
  about the project.
- It stays **outside** the repository, for the reason
  `change-worktrees.ts` already records: a second copy inside is
  something every recursive tool walks into.
- **Not the system temporary directory**, though it was proposed and the
  reasoning was sound as far as "these are disposable". It is swept by
  things that cannot know whether the transfer happened, and a sweep
  bypasses the refusal that protects uncommitted work. See ADR 0027.
- **Removal harvests first.** The directory's run history is merged into
  the repository's own before the directory goes. Entries already carry
  their `cwd` and `changeDir`, so a combined log is unambiguous and
  de-duplicates by `runId`.
- **What is not harvested is named**, at the point of removal. A
  destroyed thing that was announced is a decision; one that was not is
  a discovery, made later, by whoever needed it.
- Existing directories are **reported and movable**, never moved
  silently. Directories the tool did not create are reported and left
  alone.

## Impact

- `packages/core` — where a directory goes, and what leaves it before it
  is removed.
- `packages/cli` — `worktree add` creates under the root; `worktree
  remove` harvests and reports; a command to relocate what already
  exists.
- No change to how a run writes its log. Writes stay per-directory,
  which is what keeps two runs off one file.

See `docs/adr/0027-a-working-directory-is-disposable.md`.

# Run two changes at the same time

One workspace permits one mutating run, and that rule does not bend. Two
changes at once means two workspaces.

**1.** Give the change a working directory of its own — a git worktree,
on a branch named after the change, cut from `main`, placed beside the
repository rather than inside it.

```bash
openspec-ui-cli worktree add my-change
```

**2.** Run it there.

```bash
openspec-ui-cli run my-change --cwd ../my-repo.worktrees/my-change
```

Each directory takes its own lease, so the two runs cannot collide over
the same files.

Which changes can sensibly go at once is not a guess:

```bash
openspec-ui-cli ready
```

It reports, for each ready change, the others it can be started
alongside and what any two would collide over — the capabilities their
spec deltas name, and the files their branches have already changed.

When you are done, `openspec-ui-cli worktree remove my-change`. If a run
in one of those directories was killed rather than stopped,
`openspec-ui-cli lease` says who holds it and `lease release` clears it
where the holder can be shown to be gone.

Options, defaults and where a working directory is placed:
`openspec-ui-cli --help`.

# Run two changes at the same time

One workspace permits one mutating run, and that rule does not bend. Two
changes at once means two workspaces.

**1.** Give the change a working directory of its own — a git worktree,
on a branch named after the change, cut from `main`, placed under one
root outside the repository rather than inside it. The root is
`OPENSPEC_UI_WORKTREE_ROOT`, then `~/.openspec-ui/settings.json`, then
`.worktrees` beside the repository; the directory is
`<root>/<repository>/<change>`.

```bash
openspec-ui-cli worktree add my-change
```

**2.** Run it there.

```bash
openspec-ui-cli run my-change --cwd ../.worktrees/my-repo/my-change
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

To watch both, open the Pipeline, in the standalone app's tab or the
editor's "OpenSpec Workbench: Open Pipeline" panel. It draws every working
directory of the repository and what each run last said it was doing.
`openspec-ui-cli status` prints the same from a terminal. To stop one of
them, see [stop a run](stop-a-run.md).

When you are done, `openspec-ui-cli worktree remove my-change`. If a run
in one of those directories was killed rather than stopped,
`openspec-ui-cli lease` says who holds it and `lease release` clears it
where the holder can be shown to be gone.

Options, defaults and where a working directory is placed:
`openspec-ui-cli --help`.

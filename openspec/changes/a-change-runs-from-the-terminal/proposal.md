# A change runs from the terminal

## Why

Asked for on 2026-09-10, translated because every file here is English:
"Can our CLI utility run changes? If not, it should be able to. It
should also be able to run Lint and Tests."

It cannot. `packages/cli` has three commands — `validate`,
`change-graph`, `release-manifest` — and every one of them reads. The
harness that actually performs a change runs only where a person is
watching it: the standalone shell's Change Editor tab, or the VS Code
context menu. Both are UIs.

That was a deliberate decision. ADR 0007 scoped the CLI to `validate`
and rejected "plan/implement/status as CLI commands" on two grounds: no
approved use case existed, and the capability "duplicates what the two
interactive delivery targets already provide (through a human-in-the-
loop UI, which a CI runner is not)".

Both grounds have moved.

The first is now answered: the owner asked for it, and two things the
repository has since built need it. A scheduled run
(`scheduled-runs.ts`) fires whether or not a window is open. Parallel
changes in worktrees — the next change in this series — needs something
that starts a chain per worktree without one editor per branch.

The second is no longer true of the product. When ADR 0007 was written,
every chain stopped at a person. It does not now: a per-change
`autonomyLevel: "autonomous"` runs `propose → review → apply → verify →
archive` with no confirmation at all, and `semi-autonomous` with
`checkpoints.requireConfirmationBetweenSteps: false` does the same.
Those configurations describe a run with no human in the loop, and the
only thing standing between them and a terminal is that nobody wrote
the entry point.

There is a third fact worth recording, because it is the sort of drift
this repository is supposed to catch: ADR 0007's "one command" scope was
overtaken twice without an ADR. `change-graph` arrived in #250 and
`release-manifest` in #218. The scope line in ADR 0007 decision 2 and
ADR 0009 decision 4 has been false since August. This change replaces
it with a rule instead of a list.

## Capabilities

### New

- A change can be run from a terminal, through the same chain, the same
  allowlist, the same working-directory sandbox and the same audit log
  that a run started from either UI goes through.
- A change's declared mechanical checks can be run on their own, with no
  agent invoked and nothing spent — which is what "run Lint and Tests"
  asks for, scoped to the checks that change actually declares.
- The cross-host workspace lease knows a third kind of host, so a
  terminal run and an editor cannot mutate one workspace at once.

### Modified

- The CLI's scope is a stated rule rather than a list of commands, and
  ADR 0007's and ADR 0009's scope decisions are superseded by it.

## Out of scope

Lowering a gate. The CLI runs what the change's resolved configuration
already permits and refuses everything else; there is no flag that makes
an `assisted` change run a chain, and none that answers a checkpoint the
configuration asked for. A terminal is a thinner surface than a UI, not
a more privileged one.

A `lint` or `test` command of the CLI's own. The repository already has
`npm run lint` and `npm run test`, and a second spelling of them in a
tool whose subject is changes would be a worse copy with its own drift.
What the CLI runs is the set of checks a change's `tasks.md` declares —
a closed registry core already owns (ADR 0019).

Running more than one change at a time. One terminal, one change. The
worktree work that needs several is the change after this one, and it
will need this one's entry point to exist first.

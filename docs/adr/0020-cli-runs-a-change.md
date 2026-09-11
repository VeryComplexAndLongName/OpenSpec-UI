# 0020: The CLI Runs a Change

Status: Accepted

Date: 2026-09-11

Supersedes: ADR-0007 decision 2 and ADR-0009 decision 4 (the CLI's
"`validate` only" scope).

## Context

ADR-0007 added `packages/cli` as a third thin adapter over
`@openspec-ui/core` and scoped it, in decision 2, to a single command:
`validate`. Its third rejected alternative turned that down explicitly —
"building out `plan`/`implement`/`status`/etc. as CLI commands duplicates
capability the two interactive delivery targets already provide (through
a human-in-the-loop UI, which a CI runner is not) and adds surface area
with no consumer". ADR-0009 restated the scope in its decision 4 while
deciding how to publish the package.

Two things have changed since, and one has already gone wrong.

**The product is no longer human-in-the-loop everywhere.** ADR-0011 and
ADR-0012 introduced the Agentic Harness chain and its autonomy levels.
A per-change `autonomyLevel: "autonomous"` runs `propose → review →
apply → verify → archive` with no confirmation at all, and a
`semi-autonomous` change setting
`checkpoints.requireConfirmationBetweenSteps: false` does the same. Those
are configurations of a run with no person in the loop. The premise that
running a change requires a UI because a person must be present is no
longer true of the system as built; what is left standing between such a
configuration and a terminal is that nobody wrote the entry point.

**There is now a consumer.** The owner asked for it on 2026-09-10. Two
capabilities already in the repository need it: `scheduled-runs.ts` fires
whether or not a window is open, and the parallel-changes-in-worktrees
work that follows this ADR needs to start a chain per worktree without
one editor per branch.

**The scope line was already false.** `change-graph` was added in #250
and `release-manifest` in #218, neither through an ADR amending the "one
command" decision. Restating a list that has been overtaken twice would
produce a third silent overrun. A rule can be applied by the next person
to arrive; a list can only be broken.

## Decision

1. **The CLI gains `run <change>` and `check <change>`.** `run` executes
   one change through the same `HarnessChainRunner` the two interactive
   hosts use, resolving the change's harness configuration and
   dispatching through the same `resolveRunWithHarnessTarget`. `check`
   runs the mechanical checks that change's `tasks.md` declares
   (ADR-0019's closed registry) and invokes no agent.

2. **The scope becomes a rule, replacing the list.** The CLI may expose a
   capability core already owns where that capability needs no
   human-in-the-loop UI to be used correctly. It may never expose one the
   interactive hosts do not have. Anything requiring a picker, a
   diff view, or a decision a person makes while looking at something is
   out of scope by construction rather than by enumeration.

3. **The terminal is a thinner surface, not a more privileged one.** The
   CLI runs what the change's resolved configuration already permits and
   provides no flag that permits more. There is no `--autonomous`, no
   `--yes` that answers a checkpoint, no way to start a chain for an
   `assisted` change. This is the condition on which decision 1 is
   acceptable at all: a second entry point into an agent harness is safe
   only while it cannot do anything the first two could not already be
   configured to do. A flag that bypassed a configured checkpoint would
   make the CLI the way around the configuration, and the configuration
   is where this product keeps the user's consent.

4. **A confirmation is answered by a person or the run does not start.**
   Where the configuration asks for a checkpoint and standard input is a
   terminal, the CLI asks and waits. Where input is not a terminal, the
   whole run is refused before the first stage — not at the first
   checkpoint, because a change whose proposal a dead chain already
   rewrote is worse off than one never started. The refusal names the
   setting that would make the change runnable unattended.

5. **Every refusal happens before anything is spent, including an
   unavailable agent.** The resolution checks each stage's agent up
   front. A chain that discovers at `apply` that its agent is missing has
   already paid for `propose` and `review`; an interactive host can
   afford that because a person is watching, and an unattended run
   cannot.

6. **A terminal run is a first-class host.** It takes the ADR-0010
   cross-host workspace lease under a third `hostKind`, writes to the
   same audit log, and is subject to the same budget ceilings, which are
   enforced inside the chain runner and read from that same log. A run
   started from a terminal is visible in the Processes view and counted
   in the same totals.

7. **ADR-0007's exit-code contract is extended, not replaced.** `0` the
   chain completed; `1` the change did not — a stage failed, declared
   checks failed, or the run was cancelled; `2` the CLI declined to start
   or could not. Every refusal in decisions 3-6 is a `2`: nothing about
   the change was found wrong, the tool declined.

## Rejected Alternatives

### A flag that runs any change unattended

Rejected, and it is the central rejection of this ADR. It would make the
CLI strictly more privileged than the UIs, which is the opposite of what
a thin adapter is, and it would relocate the decision about unattended
execution from a file a person edits and reviews into a shell history.
The per-change `harness.json` already expresses exactly this intent, is
version-controlled, and is refused at the global level for the same
reason.

### Refuse at the first checkpoint instead of before the run

Rejected: by then `propose` has run and the change's own files have been
rewritten by a chain that is about to die. The cost of being right late
is paid in the artifact the run was supposed to produce.

### A `lint` and a `test` command of the CLI's own

Rejected: the repository has `npm run lint` and `npm run test`, and a
second spelling of them inside a tool whose subject is changes would be a
worse copy that drifts. `check` runs what the change declares, from a
registry core owns — which is what the request for "lint and tests"
actually needs, scoped to one change.

### Run several changes concurrently

Rejected for now: the workspace lease permits one mutating run per
workspace, so concurrency needs filesystem isolation first. That is the
worktree change that follows, and it needs this entry point to exist
before it can use it.

### Leave the scope as a list and add two entries to it

Rejected: the list has been overtaken twice without an ADR. A rule can be
applied by whoever arrives next; a list can only be quietly exceeded.

## Consequences

- The CLI's bundle grows to include the agent adapters, the chain runner
  and the security layer. That is the cost of the adapter staying thin;
  the alternative is logic in the CLI, which ADR-0001 forbids.
- A CLI command can now spend money, which none could before. The
  existing ceilings apply unchanged because they live in the chain
  runner, not in a host.
- `WorkspaceLeaseHostKind` gains a member. An already-installed older
  build reading a `"cli"` lease will mislabel its holder while still
  correctly treating the workspace as held; that cannot be fixed from
  here, and the label is made exhaustive going forward.
- A fourth consumer of the harness would now be argued against decision
  2's rule rather than against a list, which is the point of restating it
  that way.

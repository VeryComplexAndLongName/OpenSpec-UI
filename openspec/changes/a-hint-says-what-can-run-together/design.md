# Design

## Decisions

**A hint is a pure function of facts already gathered, in core.**
`buildHints(report: ChangeReadinessReport, options): Hint[]` in
`packages/core/src/hints.ts` takes the readiness report and returns
hints. It reads no file, spawns nothing, and has no clock of its own
beyond a timestamp passed in. Both hosts and the CLI call it on the
report they already have.

Rejected: a background service that analyses the workspace on a timer
and pushes suggestions. It was the review's own suggestion and it buys
nothing here: the readiness report is already rebuilt on the events that
change it, so a timer would recompute the same answer between changes,
hold a lease-shaped question open about which host owns the analysis,
and make "hints are off" mean "still computed, not shown". A hint that
appears because a file changed is the same hint, arriving for a reason a
reader can explain.

Rejected: computing hints in `webui`. ADR 0001: behaviour lives in core.
A hint computed in the shared UI could not be printed by the CLI, and
`packages/cli` is where a person automating this would want it.

**Every hint carries the exact commands.** A hint is
`{ id, kind, subject, because, commands: string[] }`. `because` states
the fact it was derived from ("both are ready, and their deltas touch no
capability in common"), and `commands` are lines a person can paste. A
suggestion without a command makes the reader translate advice into
action, which is the work the hint was supposed to save.

**All maximal sets, or none.** Where more than two changes can run
together, the hint names every maximal compatible set rather than one.
Three changes with one collision between two of them produce two sets,
and naming both preserves the decision `readChangeReadiness` documents:
the reader chooses, and can see that there was a choice. Where the sets
would exceed a stated cap, the hint says how many there are and names
none — a truncated list looks like a recommendation.

Rejected: ranking sets by size and showing the best. "Optimal" here is
not a property of the repository; it depends on which change the person
wants finished first, which the repository does not know.

**Off means not computed.** The setting is read where the report is
built, and with hints off `buildHints` is not called. A hint that is
computed and hidden costs the same and is a different promise than the
one the switch makes.

**No new transport.** Hints ride on the readiness payload the standalone
server and the extension bridge already return; no command and no event
is added to the protocol. `a-graph-of-what-is-running` added the
readiness facts in core and the client both hosts use
(`packages/core/src/change-readiness-facts.ts`,
`packages/webui/src/change-readiness-client.ts`); this change adds a
component beside them, never a second client.

## Non-Goals

- Creating, editing, or starting anything.
- Generating an OpenSpec change.
- Task-level parallelism inside one change. Tasks declare no file paths
  today — `collisionsBetween` works from a change's spec delta and its
  branch's changed files, neither of which exists per task — so a hint
  about two tasks would be inference from prose, which is exactly the
  guess this design refuses. Making tasks declare paths is a separate
  change, and this one is written so that hints over it would be another
  `Hint` kind rather than a new mechanism.
- Any timer, watcher, or background process.
- Scoring, ranking, or recommending one plan.

## Risks / Trade-offs

**Advice that is wrong once is never trusted again.** Every hint states
the fact it came from, so a reader can check it in one step; and every
hint kind is derived from a collision type `readChangeReadiness` already
computes, rather than from a new heuristic. The failure mode to avoid is
a hint that "looks plausible": a wrong hint whose reason is printed is
reported, a wrong hint without one becomes folklore.

**Hints become noise.** Mitigated by the cap on maximal sets, by hints
being derived only where an action exists, and by the switch. What is
not mitigated: a repository with twenty ready changes will produce a lot
of hints. The verification includes a fixture of that size, and the
outcome — whether the list is usable — is a human-only item.

**Protocol impact: none.** No command or event is added or changed. The
readiness payload gains an optional `hints` array, which existing
adapters ignore; `server` and `extension` both pass the payload through,
and a host built before this change renders exactly what it does today.

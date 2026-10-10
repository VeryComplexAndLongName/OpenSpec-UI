## Context

`buildDefaultAgentRunners({ workspaceRoot })` makes a host's agents, each
with a sandbox (`checkCwdSandbox`) that refuses a `cwd` outside
`workspaceRoot`. Both hosts already make a second set for a worktree
(`runnersFor`), for a card's delegated task (a-card-works-its-own-tasks);
nothing else used it.

## Decisions

- **Choose the agents by where the run runs.** `runRootOf(cwd, workspace,
  container)` says the root a `cwd` is bound to: the workspace, the one
  worktree under `container` (`<worktree root>/<repository>`) it is in, or
  nothing. `agentsByRunRoot` gives the workspace's agents for the first and
  the third, and a worktree's own agents, made once and kept, for the
  second - so a permission's answer or a cancel reaches the same runner
  the run started on.
- **The sandbox stays.** A `cwd` outside both still gets the workspace's
  agents, and their sandbox refuses it, with the words it always had. The
  container is the one the standalone server already admits a page's `cwd`
  by (ADR 0043 decision 5), read once at start the same way.
- **One parameter, not a new interface.** `resolveRunner(agentId, cwd?)`:
  every existing caller keeps compiling, and the ones that know the run's
  directory pass it.
- **The run dialog's answers act where the change is.** Its context's
  `cwd` is set by the host from where the change is worked, so a
  configuration applied there writes that worktree's `harness.json`.

## Risks / Trade-offs

- A run started before the container is read gets the workspace's agents
  and is refused as before → the container is read at activation, well
  before a person opens a run dialog.

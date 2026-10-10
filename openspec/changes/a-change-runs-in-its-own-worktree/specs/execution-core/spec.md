## ADDED Requirements

### Requirement: A run in a change's own worktree runs on that worktree's agents

A host SHALL give a run whose `cwd` is inside one of its repository's
worktrees, under `<worktree root>/<repository>/`, that worktree's own
agents, whose sandbox is that worktree, made once and kept for every later
run and request there. A run in the workspace SHALL get the workspace's
agents. A run anywhere else SHALL get the workspace's agents, whose sandbox
refuses it as before. This SHALL hold for a chain's stages, a single stage,
and a card's controls of a run, in the editor and in the standalone app.

Where a change is worked in its own worktree, the editor's run dialog SHALL
read and write that worktree's copy of the change's harness.

#### Scenario: A change run from the card of its own worktree

- **WHEN** a chain of `mcp-platform-foundation` runs in
  `../.worktrees/HppMCP/mcp-platform-foundation`, the workspace being
  `HppMCP`
- **THEN** its stages run on that worktree's agents, and none is refused
  as outside the workspace

#### Scenario: A directory of no worktree

- **WHEN** a run names a `cwd` outside the workspace and outside its
  repository's worktrees
- **THEN** it is refused as outside the workspace

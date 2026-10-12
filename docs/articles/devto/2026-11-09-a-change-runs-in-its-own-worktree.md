---
title: A change runs in its own worktree
published: false
description: A run inside one of the repository's worktrees is given that worktree's own agents, whose sandbox is that worktree. Any other run gets the workspace's, whose sandbox still refuses a directory that is neither.
tags: openspec, devtools, vscode, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/a-change-runs-in-its-own-worktree/cover.jpg
canonical_url: https://openspec-ui.dev/articles/a-change-runs-in-its-own-worktree/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/a-change-runs-in-its-own-worktree/).*

The owner ran a change of `HppMCP` from its card, where a-change-is-committed-where-it-is-made
had just put Run Change...:

> stage started: apply (local-llm-acp)
> failed: cwd "C:/Prog/.worktrees/HppMCP/mcp-platform-foundation" is outside the workspace "c:\Prog\HppMCP"

A host binds its agents to one root, its workspace, and every agent's
sandbox refuses a run whose `cwd` is outside it. A change is made in a
worktree of its own (ADR 0043), under `<worktree root>/<repository>/`,
which is not inside the workspace. The chain, a single stage, and a card's
controls of a run all resolved their agent by its id alone, so every run
in a worktree was refused — in the editor and in the standalone app alike.

The CLI never met it: `openspec-ui-cli run change --cwd` builds its agents
for that directory. The run dialog's answers had the same blind spot:
applying a named configuration wrote the checkout's copy of the change's
`harness.json`, not the worktree's.

## Worktree-specific agents

A run inside one of the repository's worktrees is given that worktree's
own agents, made once per worktree, whose sandbox is that worktree. Any
other run gets the workspace's, whose sandbox still refuses a directory
that is neither. `runRootOf` and `agentsByRunRoot` in core decide it.

The chain runner asks for its agent with the stage's `cwd`; the editor's
AI panel, its card controls and the standalone server's chain and socket
runs do the same.

## The run dialog, fixed

The run dialog's answers in the editor read and write the change's
harness where the change is worked. Before this, applying a named
configuration wrote the checkout's copy of the change's `harness.json`,
not the worktree's. Now it writes the worktree's copy, and reads it back
from the same place.

## What this changes about the workflow

Before this, a change in its own worktree could be acted on but never run
from its card. The card's Start was refused for a change this checkout
does not have. Now it runs in the change's worktree, in both hosts. The
card offers Run Change... alongside its other actions, and the action
runs where the change is worked.

## Try it

The code is at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

```bash
openspec-ui-cli run change --cwd C:/Prog/.worktrees/HppMCP/mcp-platform-foundation
```

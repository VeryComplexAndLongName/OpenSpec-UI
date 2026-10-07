## Why

The owner, on 2026-10-07: in other repositories, agents creating a change
make it in the current folder, on the current branch. Nothing this product
writes into a repository tells them otherwise: the "Generate Agent
Instructions" block held only Node and Python style notes, and was not
offered at all where `CLAUDE.md` and `AGENTS.md` existed. The product's own
"Create OpenSpec Change" did the same, and a working directory could be
made only for a change already committed (ADR 0022 decision 3). ADR 0043
records the decision.

## What Changes

- A section "How work is done in this repository" in `CLAUDE.md` and
  `AGENTS.md`: each change in a git worktree of its own at
  `<worktree root>/<repository>/<change-id>`, on a branch named after it
  cut from `origin/main`; how to make it; where the stage assignment is,
  and that a stage named for another agent is handed back.
- Written when a repository is initialized, in both hosts, and on demand
  ("Write Agent Workflow Rules"). A file somebody else wrote gets it at its
  end only where the person says so.
- `openspec-ui-cli worktree add` makes a directory for a change that
  exists nowhere yet; a change only uncommitted in the checkout still
  refuses.
- "Create OpenSpec Change" makes the change in its own working directory,
  in both hosts; the standalone may work in the repository's own working
  directories.

## Capabilities

### Modified Capabilities

- `execution-core`: the workflow rules; a working directory for a new
  change; a new change made in its own directory.
- `vscode-extension`: the rules written on initialize and on demand; Create
  in a working directory.
- `shared-ui`: the standalone's init checkbox; the page follows a new
  change to its directory.

## Impact

- `packages/core`: `agent-workflow-rules.ts`, `managed-sections.ts`,
  `change-in-its-worktree.ts` (new); `repo-bootstrap.ts`,
  `change-worktrees.ts`, `index.ts`.
- `packages/extension`: `commands.ts`, `package.json`.
- `packages/server`: `rest.ts`, `server.ts`.
- `packages/webui`: `standalone-entry.tsx`, `shell-ui.ts`.
- `docs/adr/0043-a-change-is-made-in-a-working-directory-of-its-own.md`,
  `docs/how-to/run-changes-side-by-side.md`.
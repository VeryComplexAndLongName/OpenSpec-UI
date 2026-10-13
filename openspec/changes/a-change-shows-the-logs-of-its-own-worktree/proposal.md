# Proposal

## Why

A change is worked in the worktree made for it (ADR 0027 keeps one root for
them), and a run there writes its log under that worktree's
`.openspec-ui/runs`. A card's Show Logs reads only the host's own root, so for
a change worked in its own worktree it answers "nothing" while the logs sit
one directory away. Measured on 2026-10-12 with the very call the button
makes: `listRunLogs` over the host root returned 0 logs for
`remaining-groups-move-into-the-register`; over its own worktree, 2.

Two more defects share the cause. Opening one run sends only its run id, so
a list that found the logs could not open one. And the card of a change
worked in its own worktree, drawn from another directory's picture, offers no
Show Logs at all, although `a-change-shows-its-run-logs` says every card has
one. ADR 0026 decides that a change is the pair of a directory and a name and
that a request is data, never a path to read: the host finds the worktree
from the name.

## What Changes

- Core resolves where a change's logs are: the change's own worktree where
  `git worktree list` has one, else the host's root. A request names the
  change, never a path.
- `pipeline/run-logs` and `pipeline/run-log` (extension) and
  `/api/run-logs/list` and `/api/run-logs/read` (server) read from that
  place. Reading one run's log names its change, so it is read where the
  list found it.
- The card of a change in its own worktree, drawn from another directory's
  picture, offers Show Logs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-core`: where a change's run logs are read from.
- `standalone-app`: the log endpoints read a change's own worktree; Logs on
  every card.
- `vscode-extension`: the bridge operations read a change's own worktree.

## Impact

`packages/core` (`run-log.ts`, a resolver beside `own-worktree-tasks.ts`),
`packages/server` (`rest.ts`), `packages/extension`
(`webview/pipeline-panel.ts`), `packages/webui` (`run-logs-client.ts`,
`pipeline-entry.tsx`, `standalone-entry.tsx`, `PipelineView.tsx`). No
command or event of the protocol changes; the two read operations gain an
optional `changeName`, so an old caller that sends none reads the host root as
before. A patch-level behaviour fix for each affected package.

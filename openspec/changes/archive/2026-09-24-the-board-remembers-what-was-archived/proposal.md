## Why

Asked by the owner on 2026-09-23: the kanban is fine, but we have a heap
of archived changes - where are they in Archived?

Nowhere, and not by accident. The Pipeline draws **active** changes; the
report excludes the archive on purpose, because it is about what can be
run. Archiving moves a change's directory into
`openspec/changes/archive/<date>-<id>`, so the moment a change becomes
Archived it leaves the source the board draws from. The last column is
empty by construction, and the only thing that could ever appear in it is
a change archived on the server that this checkout has not caught up with
- which is not "the archive", it is "you are behind".

A column that can never hold anything says nothing about the way through.

## What Changes

- The Archived column draws the changes archived most recently, each
  saying the day it was archived and offering no action. Under the board,
  one line counts everything not drawn.
- What is drawn is bounded **twice**: a window of days and a count. The
  window alone follows the pace of the work - a week of this repository is
  75 archived changes, which is a wall rather than a column - and a count
  alone would show a quiet repository changes archived months ago.
- The archive is read from the **default branch on the server**, so every
  machine that has fetched sees the same archive. A working directory's
  own copy is as stale as that directory, and a worktree on its own branch
  may lack the newest archives entirely; two people looking at "the"
  archive and silently seeing different things is what this avoids. Where
  that branch cannot be read, this directory's archive is read and the
  line beneath the board says so.
- The day comes from the archived directory's own name. No commit, no
  blame, no forge: one listing of one tree answers the whole question. A
  name with no date is left out rather than dated by a guess.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - what the board's last column holds.

## Impact

- `packages/core/src/archived-changes-facts.ts` and
  `archived-changes.ts` (new), with their tests.
- `packages/webui/src/components/PipelineView.tsx`,
  `change-stages-client.ts`, `bridge-request.ts`, both entry points.
- `packages/server/src/rest.ts` and `server.ts`: one route.
- `packages/extension/src/webview/pipeline-panel.ts`: one reader.
- One requirement in `openspec/specs/shared-ui/spec.md`.

## Explicitly out of scope

- **Opening an archived change from its card.** The card says what it is
  and when it closed. Reading an archived change is what the Timeline and
  the change views are for.
- **A setting for the window or the count.** Two numbers with reasons
  beat two settings with none; if a repository proves them wrong, the
  reason to change them will be a measurement, as these were.

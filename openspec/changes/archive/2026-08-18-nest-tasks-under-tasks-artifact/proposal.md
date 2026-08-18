## Why

Reported live, twice: task checklist items in the "Changes" and
"Archive" trees appeared as flat siblings of the "Tasks" artifact item
(the `tasks.md` file entry, alongside "Proposal"/"Design"/"Spec: X"),
not nested *under* it. The previous investigation (`tree-item-stable-
ids`) correctly found and fixed a real, separate bug (missing stable
`.id` on tree items), but that fix left the exact same visible symptom
completely unchanged — because it was never the actual cause. The real
cause is structural: `getChangeChildren` always returned individual task
items as flat siblings of every artifact, including the "Tasks" artifact
itself, and the "Tasks" artifact was a plain non-collapsible leaf
(`ArtifactTreeItem`, same as Proposal/Design/Spec) with no mechanism to
ever nest anything under it.

This was diagnosed wrong the first time because every prior smoke test
only checked `getChildren()` *return values* against mocks, which
faithfully confirmed "task items are present and structurally correct
among a Change's children" — true, but not the actual complaint. This
change is verified differently: a new test drives the real, registered
`ChangesTreeProvider` inside a real Extension Host
(`src/test/suite/extension.test.ts`), walking the actual tree structure
two levels deep against a real fixture `tasks.md` — the kind of check
that would have caught the original bug immediately instead of shipping
an unrelated fix twice.

## What Changes

- The `tasks.md` artifact is now its own `TasksArtifactTreeItem`,
  collapsible when the file exists (a plain leaf, like every other
  artifact, when it doesn't). Expanding it — not the Change directly —
  returns the individual checklist items.
- `getChangeChildren` (shared by both "Changes" and "Archive" trees) no
  longer returns task items at all; it only returns artifacts, with the
  "tasks" kind rendered as the new collapsible item.
- Clicking the "Tasks" label still opens `tasks.md`, unchanged — VS Code
  supports a `.command` and `collapsibleState` on the same item
  independently; the disclosure arrow and the label click are separate
  interactions.
- `readTaskChecklist` is now called lazily, only when "Tasks" is
  actually expanded, not eagerly whenever the Change itself is expanded.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension`: task checklist items now nest under the "Tasks"
  artifact specifically, not flat under the Change alongside every
  other artifact.

## Impact

- `packages/extension/src/tree/changes-tree.ts`
  (`TasksArtifactTreeItem`, `getChangeChildren` no longer async and no
  longer takes `workspaceRoot`, new `getTasksArtifactChildren`),
  `src/tree/archive-tree.ts` (dispatches to the new class/function too).
- `packages/extension/src/extension.ts` (`ExtensionTestApi.changesTree`
  — new, test-only export so integration tests can drive the real
  registered provider).
- `packages/extension/src/test/suite/extension.test.ts` (new live test
  against the real fixture workspace).
- `changes-tree.test.ts`, `archive-tree.test.ts` rewritten for the new
  two-level expand structure.

## Why

Reported from live use: in the "Changes" and "Archive" tree views, task
items render at the *same* nesting level as the Change they belong to
instead of nested under it, and don't collapse/expand.

Root cause: no `TreeItem` subclass in `changes-tree.ts` or
`templates-tree.ts` sets an explicit `.id`. Per VS Code's own API
contract, when `.id` is omitted the tree falls back to a label-derived
identity — and every `getChildren()` call in this codebase constructs
brand-new item instances (never reuses object references, by design,
matching the rest of this session's tree work). Without a stable id to
reconcile against, VS Code's internal tree diffing can desync across
refreshes, which is exactly the reported symptom class: children
rendering flush with their parent, losing collapse/expand state. This
had never been visually verified in a real running VS Code window this
session — every prior smoke test for tree features was necessarily
limited to unit tests against `getChildren()`'s *return value* (correct)
and a real Extension Host activation check (confirms the extension
loads, not how the tree actually renders) — the gap this bug fell
through is explicitly disclosed in several `smoke-test-notes.md` files
already ("no desktop-UI automation tool is available in this
environment").

## What Changes

- Every `TreeItem` subclass in `changes-tree.ts`
  (`ChangeTreeItem`, `ArtifactTreeItem`, `EmptyTreeItem`, `TaskTreeItem`)
  and `templates-tree.ts` (`TemplateGroupTreeItem`, `TemplateTreeItem`,
  `EmptyTemplatesTreeItem`) now sets an explicit, stable `.id`, derived
  from data that's already unique at that item's scope (e.g.
  `task:<archived>:<changeName>:<lineNumber>`,
  `artifact:<absolutePath>`, `template:<origin>:<manifestId>`) —
  never label-derived, never dependent on object identity surviving a
  refresh.
- `templates-tree.ts` gets the same fix even though it wasn't part of
  the report — it has the identical latent defect (real nested
  collapsible groups, no explicit ids anywhere), just not yet reported.
- No behavior change to *what* the trees show — this is a rendering-
  identity fix, not a new capability.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension`: the existing task-nesting requirement now also
  requires stable, non-colliding item identity, not just correct
  `getChildren()` return values.

## Impact

- `packages/extension/src/tree/changes-tree.ts`,
  `changes-tree.test.ts`, `archive-tree.test.ts` (shares
  `getChangeChildren`/`ChangeTreeItem`, no source changes needed there).
- `packages/extension/src/tree/templates-tree.ts`,
  `templates-tree.test.ts`.

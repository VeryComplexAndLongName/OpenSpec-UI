## Why

On 2026-09-22 a user of 0.70.0 reported three things from the Changes
view and the harness settings.

- **A change not written yet cannot take a relation.** They had made
  `openspec/changes/dashboard-contacts/` with `/opsx:new`, so the directory
  held `.openspec.yaml` and nothing else. The view listed it with a (?)
  icon, and right-clicking it opened no menu. With a dummy `proposal.md`
  added, Add Relation and Remove Relation worked "like a charm".

  The (?) row is a leftover: a directory with no proposal, design, tasks
  or specs is not a change (`holdsChangeDocuments`). Its only action is
  the inline Remove icon, which does not appear on right-click. But
  relations live in `.openspec.yaml`, which such a directory already
  holds. Core's graph reads every directory under `openspec/changes/`,
  and `editChangeRelation` edits one without a document just as well. A
  person who plans the order of work before writing the proposals is the
  person the relation edit exists for.
- **Remove Relation is offered on a change that states none.** It opens
  and then says "states no relation to remove". The user asked for it to
  be unavailable instead.
- **Two texts contradict the build.**
  - HARNESS.md says `stepAgents.<stage>.model` is "Not editable in either
    UI". Both harness views have had a Model field, offered for an agent
    whose CLI takes a model.
  - The per-change harness quick pick describes `agent-sufficient` as
    "Currently a no-op - the git stepAgent's commit/push action does not
    exist yet". The `git` stage has pushed, opened and merged a pull
    request since `agentic-harness-git-stage`.

## What Changes

- **A directory that is not yet a change takes a relation.** A leftover
  whose name no archived change has is one "you have not written yet". It
  gets a context value of its own, `openspec-ui.unwrittenChange`, and
  offers Add Relation and Remove Relation beside its inline Remove.

  A leftover whose change is archived keeps `openspec-ui.leftover` and
  offers only removal: its relations are history.

  Its tooltip says what it lacks: relations can be stated now, and the
  rest of a change's menu arrives with its first proposal, design, tasks
  or specs.
- **Remove Relation appears only where there is something to remove.** A
  row whose change states a relation takes `.related` after its usual
  context value: `openspec-ui.activeChange.related`,
  `openspec-ui.graphActiveChange.related`,
  `openspec-ui.unwrittenChange.related`. Remove Relation names only those.
  Every other clause that names a plain value also names its marked one,
  and the code that asks what kind a row is reads it without the mark.

  - The Changes view learns which changes state a relation from core's
    `readChangeGraph`, on activation and whenever a change's
    `.openspec.yaml` or a change directory changes.
  - A Change Graph row knows it from its own node.

  The fact rides the context value because nothing else reaches a row's
  menu. VS Code 1.137 evaluates it against `view` and `viewItem` alone. A
  first attempt matched `resourceFilename` against a context key, passed
  every unit test, and never matched in the editor.

  VS Code's context menus have no disabled state, so the entry is hidden
  rather than greyed. The command keeps its message for the palette, which
  no `when` clause governs.
- **The texts say what the build does.**
  - HARNESS.md's "Where each setting is edited" table lists `.model` with
    the fields the harness views edit.
  - The quick pick describes `agent-sufficient` as what it now is: the
    `git` stage may push and merge without a person, within the change's
    `gitStageAllowlist`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension` - relation edits on a change not yet written; Remove
  Relation only where a relation is stated.

## Impact

- `packages/extension/src/relations-context.ts` (new),
  `tree/changes-tree.ts` (`LeftoverTreeItem`, `setStatingRelations`),
  `tree/change-graph-tree.ts`, `commands.ts` (`relationSubject`, the
  review gate pick), `follow-selection.ts`, `extension.ts`, `package.json`
  (menus).
- `HARNESS.md`.
- A changeset: the extension, patch.

## Explicitly out of scope

- **Showing a change without documents in the Pipeline.** The user also
  saw an empty Pipeline for it. The Pipeline draws what the readiness
  report reads, and a directory without a task list has no readiness to
  report. That is a question for its own change.
- **Pausing a chain on a proposal's open questions.** The user asked how a
  question a proposal leaves open reaches a person. Nothing reads such a
  section today. It is a feature, not a correction, and wants its own
  proposal.

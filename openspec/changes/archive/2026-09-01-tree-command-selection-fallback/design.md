## Context

See `proposal.md`. Five views are registered at
`extension.ts:114-130`; the commands that need an item come from
`openspecUiChanges` (changes and their tasks), `openspecUiArchive`
(archived changes) and `openspecUiTemplates` (templates).
`openspecUiSpecs` and `openspecUiProcesses` have no item-scoped commands
in the affected set.

## Goals / Non-Goals

**Goals:**

- A highlighted row is honoured when the command arrives without an item.
- The warning survives for the case it was written for — nothing
  selected anywhere — and says something the user can act on.

**Non-Goals (this change):**

- A QuickPick chooser when nothing is selected. That was the shape
  `tree-command-selection-feedback` deferred, and it is still a bigger
  feature (a chooser per item kind, plus a two-level change→task picker).
  Honouring an existing selection is the smaller, more predictable half,
  and it is the one the live report asked for.
- Multi-select semantics. See Decisions.
- Changing which commands appear in the Command Palette.

## Decisions

### `createTreeView` for the three views that own item-scoped commands

`registerTreeDataProvider` returns a bare disposable and exposes no
selection; `createTreeView` returns a `TreeView` with a `selection`
array. The three views are switched; `openspecUiSpecs` and
`openspecUiProcesses` keep their current registration because no command
in the affected set acts on their items.

**Rejected alternative**: switch all five for uniformity. Rejected —
`createTreeView`'s handle is only worth holding where something reads it;
converting views nothing consults adds an unused field per view and
invites the reader to wonder what uses it.

### Fall back only for a single selected item of the expected kind

The fallback applies when the view's `selection` holds exactly one item
and it is of the kind the command expects. Zero, several, or a
mismatched kind all fall through to the existing warning.

**Rejected alternative**: act on `selection[0]` whenever the selection is
non-empty. Rejected — with several rows highlighted, picking the first is
an arbitrary choice the user did not make, and the command it feeds
(`archiveChange`, `deleteChange`) mutates the repository. Refusing is the
recoverable outcome; guessing is not.

### The state check stays where it is

A fallback item is subject to the same state check as a clicked one — a
selected archived change still does not archive. The fallback decides
*which* item, never *whether* the command may run.

## Risks / Trade-offs

- **[Risk]** A stale selection: a row highlighted long ago, scrolled out
  of view, is silently acted upon by a palette invocation. →
  **Mitigation**: partial and deliberate. The mutating commands that can
  be reached this way (`archiveChange`, `deleteChange`, `deleteTask`,
  `unarchiveChange`) all already require an explicit modal confirmation
  naming the target, so the item is shown before anything happens. The
  confirmation is what makes the fallback safe, and it is why this
  change does not add one of its own.
- **[Trade-off]** Two ways to reach the same command now behave
  identically, which is the point, but it does mean the Command Palette
  can mutate the repository where before it could only refuse. Accepted:
  the right-click path could always do so, and the confirmations are
  unchanged.

## Migration Plan

No migration. Registration API swap plus a resolution step inside
existing handlers; no persisted state, no protocol change.

## Why

Reported by a user on 2026-09-24, and agreed with the owner on 2026-09-25:
an agent can be configured for propose, but nothing in the Pipeline starts
it, and the board has no column for a change before its proposal. The
user's screenshot showed three such directories - `dashboard-contacts`,
`dashboard-health-pane`, `typed-role-discovery-origin`, each holding
`.openspec.yaml` and nothing else - listed in the Changes tree with a
question mark, and absent from the board.

Two things kept them off it:

- **The reading of what can run passed them over.** `discoverChanges`
  drops a directory that carries no change document, taking it for what an
  archive leaves behind. The leftover rule it borrows says more:
  `workspace-leftovers.ts` counts a directory as a leftover only where a
  change of its name was archived, and a person's fresh start is kept.
  The discovery used the first half of that rule and not the second.
- **The board has no stage for them.** ADR 0037 decision 5's closed list
  begins at Proposed, "the change has a proposal".

## What Changes

- **ADR 0037 is amended** with a first stage, Drafted: the change's
  directory exists and holds no proposal. It is entered at the directory's
  first commit, where that came before the proposal's; a change committed
  with its proposal has no Drafted visit.
- **The Pipeline reads drafts.** `discoverOpenSpecWorkspace` gains a
  `drafts` option, and the reading of what can run asks for it: a
  directory with no documents is a change unless a change of its name was
  archived. The Changes tree is unchanged, and keeps listing such a start
  apart.
- **The board has a Drafted column**, first, with no fill and the change
  picture in the quiet ink: a draft is a change and nothing yet.
- **Start on a Drafted card begins at propose**, as a chain already does
  for a change with no proposal and tasks.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the closed list of stages, and what dates Drafted.
- `openspec-workbench` - a directory with no documents, read for the
  Pipeline.
- `shared-ui` - the board's columns.

## Impact

- `docs/adr/0037-a-team-works-through-git.md`: an amendment.
- `packages/core`: `change-history-facts.ts` (the stage, its word, its
  look), `change-stage-facts.ts`, `change-stages.ts`, `change-timeline.ts`
  (a directory's first commit), `workspace-leftovers.ts` (archived names,
  and what is a change), `workbench.ts` (the `drafts` option),
  `change-readiness.ts`; with tests.
- `packages/webui/src/shell-ui.ts`: the Drafted token in three palettes.
- `packages/extension/src/commands.ts` and `webview/pipeline-panel.ts`:
  the change a card's Start names is looked up with drafts, so a Drafted
  change is not refused as missing.

## Explicitly out of scope

- **Sending a change back to Drafted.** A send-back names a stage a change
  has left; see the amendment.
- **The Changes tree.** It lists a change nobody has written yet apart from
  real work already, with a remedy; that stays.
- **What the run dialog says about where a run begins.** That is its own
  change (the dialog names the stage it starts at), planned next.

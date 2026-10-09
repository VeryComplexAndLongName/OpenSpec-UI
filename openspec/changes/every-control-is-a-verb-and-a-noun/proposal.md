## Why

ADR 0045 named every extension command and CLI subcommand as a verb and a
noun, and every-action-is-a-verb-and-a-noun carried it out. The web UI's
buttons, shown in both hosts, were left as they were named one at a time:
"Start...", "Logs", "Catch up", "Show them", "Fold them away", "Open all",
"It was me", "Clean old history", "Apply to the form". The palette now says
"Run Change..." and the card it opens says "Start...". The owner approved
the table of new labels on 2026-10-09 ("agreed with all of it").

Carrying it out also showed that four Danger buttons acted at once:
Archive them..., Clean old history, Rollback files and a leftover's Remove.
ADR 0045 says a Danger verb is always confirmed.

## What Changes

- Every web UI button outside a dialog is a pair from ADR 0045's lists,
  with three dots where it asks first; its accessible name starts with its
  visible words and adds the change it is about ("Stop Run alpha").
- A button inside a dialog, or a prompt that names what it is about, is
  the verb alone: Answer, Allow, Deny, Archive, Delete, Rollback, Cancel,
  Close. A switch says what it shows ("By stage"), not an action.
- Archive Landed Changes..., Delete History..., Rollback Process...,
  Delete Leftover... and Delete Worktree... ask in a dialog (ADR 0047)
  before they act.
- Core's vocabulary gains the verbs Schedule and Save and the nouns the
  buttons act on. ADR 0045 is amended.
- A test reads every `.tsx` source in the web UI for its buttons' words and
  holds them to the lists, and a Danger verb to its dots.
- The extension's "It was me" prompt reads "Confirm Key"; README, the
  extension's README, the server's README and the how-to on stopping a run
  name the buttons by their new words. Published articles keep theirs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: every control is a verb and a noun; the requirements that
  name a card's Start, Stop, Stop now and Update the plan name them by
  their pairs.
- `standalone-app`, `vscode-extension`: "Go to line" is Open Task.

## Impact

- `packages/core`: `action-vocabulary.ts`.
- `packages/webui`: the labels of 17 components and the standalone entry,
  confirmation dialogs in `PipelineView`, `ProcessesView` and
  `LeftoverList`, `control-vocabulary.test.ts`, and the tests that find a
  button by its name.
- `packages/extension`: the confirm-key prompt's title.
- `packages/server/e2e`: specs that find a button by its name.
- A changeset for core, webui and the extension.

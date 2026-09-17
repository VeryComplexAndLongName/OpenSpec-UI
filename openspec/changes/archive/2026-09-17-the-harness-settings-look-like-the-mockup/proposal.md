## Why

ADR 0033's fourth step. The owner compared the running Harness Settings tab
with the approved mockup's "Harness Settings" artboard on 2026-09-16: after
the summary (#545), it is the next screen that has to look like the mockup,
and it does not. Each stage is three labelled fields stacked under each
other with a paragraph about custom agents after them, four times; the named
configuration is a drop-down followed by four paragraphs; autonomy is a
drop-down with the review gate in a sentence under it; Save sits alone at
the bottom. The mockup draws one row per stage, a segmented choice of
configuration, a warning callout, and the autonomy level, review gate and
run budget side by side above Save and Discard.

## What Changes

- **The named configuration** is a segmented choice with an "Apply to the
  form" button beside it, and one paragraph under it: the effort, the
  purpose, what it is not for, and that nothing is saved until you save. The
  basis stays, as fine print. The run dialog uses the same picker.
- **What the configuration cannot do** is an amber callout with a warning
  icon.
- **The settings panel** has the mockup's head (an icon cell, the title, and
  "Recommends an agent per stage — never enforces one") and a table: one row
  per stage — its number, name, agent, model, effort and max cost — with
  archive and git as muted rows that run mechanically.
- **A stage's model can be set** where its agent is chosen, as a text field
  offered only for an agent that accepts a model. The configuration has
  carried a model since harness-step-models; the form kept it without
  showing it.
- **Custom agents** are offered under the stage's agent when the workspace
  defines some for its CLI. What a CLI takes none of, or defines none of, and
  where definitions are read from, is said once under the table rather than
  under every stage.
- **Under the table, side by side**: the autonomy level as a segmented
  choice with what the chosen level does, the review gate, and the run
  budget — the chain's cost ceiling, `budget.maxCostUsd`, which the view
  could not edit before.
- **At the foot**: Save with a check icon, Discard, "Unsaved changes", and
  where the file is saved.
- **The page head** reads as the mockup's and carries an "agent-harness.json"
  action, which shows the file as Save would write it.
- **A change's own settings**, in the Change Editor and in the editor's
  panel, use the same table, choices and foot, each saying what it inherits.
- **At narrow widths** — the editor's panels among them — each stage's row
  becomes a block with its fields labelled.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `standalone-app`: Harness Settings is laid out as ADR 0033's mockup.
- `agentic-harness`: a stage's model and the run budget are set in the
  settings views, and a settings view offers to discard what it has not
  saved.

## Impact

- `packages/webui`: `src/components/harness-settings-parts.tsx`,
  `GlobalHarnessSettingsView.tsx`, `ChangeHarnessSettingsView.tsx`,
  `NamedConfigurationPicker.tsx`, `src/page-heads.ts`,
  `src/standalone-entry.tsx`, `src/shell-ui.ts`, and their tests;
  `RunDialog.test.tsx` for the picker.
- `packages/server/e2e`: `harness-screenshots.spec.ts` drives the new
  choices; the frame spec captures the tab beside the mockup.
- `packages/extension`: none in code; its harness panels render the shared
  views and take the new layout.

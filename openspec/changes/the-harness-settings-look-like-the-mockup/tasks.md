The fourth step of ADR 0033's delivery order: Harness Settings, as the
mockup's "Harness Settings" artboard draws it
(<https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L>).

## 1. The shared parts

- [x] 1.1 `SegmentedChoice` in
  `packages/webui/src/components/SegmentedChoice.tsx`: a radiogroup of native
  radios drawn as segments, named by its label.
- [x] 1.2 `StageTable`, `StageRow` and `MechanicalStageRow` in the same file:
  the header, one grid row per stage with its number, and each cell carrying
  its column's name for the narrow layout.
- [x] 1.3 `AgentSelect`, `EffortSelect`, `BudgetInput` render as cells with
  no visible label, keeping their accessible names; a field the agent does
  not take is a muted dash with a title saying why.
- [x] 1.4 `ModelInput` and a `model` field in `StageForms`;
  `stepAgentsFromForms` writes the form's model for an agent that accepts
  one.
- [x] 1.5 `CustomAgentSelect` renders the select only; `StageNotes` says,
  once per agent or CLI, the caveat an agent's registry label carries (the
  select names the agent alone), and that a CLI takes no custom agent,
  defines none (with the directories), or had definitions refused.
- [x] 1.6 `HarnessFindingsPanel` is a warning callout with an icon, keeping
  its test ids and text.
- [x] 1.7 `globalConfigToSave` and `changeConfigToSave` take the run budget
  and lay it over the loaded `budget`.

## 2. The picker

- [x] 2.1 `NamedConfigurationPicker` offers the configurations as a
  `SegmentedChoice`, with an apply label its host names, the effort and
  purpose as one line, what it is not for and the note as the next, the basis
  as fine print, and the recommended one marked.
- [x] 2.2 `NamedConfigurationPicker.test.tsx` and `RunDialog.test.tsx` choose
  by radio.

## 3. The views

- [x] 3.1 `GlobalHarnessSettingsView` renders the picker, the callout, and the
  panel: head with icon and note, the stage table, the stage notes, the
  band of autonomy level, review gate and run budget, and the foot with Save,
  Discard, unsaved note, message and where the file is saved; with `showFile`,
  a panel with the JSON Save would write.
- [x] 3.2 `ChangeHarnessSettingsView` renders the same, with inherit choices
  for autonomy and review gate, inherit placeholders for model and run
  budget, and the change's file and "Edit global defaults" at its foot.
- [x] 3.3 `GlobalHarnessSettingsView.test.tsx` and
  `ChangeHarnessSettingsView.test.tsx` choose by radio, and assert the model
  saved, the run budget saved over other budget keys, Discard reading the
  file again, the notes said once per CLI, and the file panel.
- [x] 3.4 The Harness Settings tab in `standalone-entry.tsx` takes the page
  head's "agent-harness.json" action, and `page-heads.ts` the mockup's
  sentence, with the pointer to a change's own settings kept in it.
- [x] 3.5 `shellThemeCss` draws the segments, the callout, the panel head's
  icon cell, the stage grid and its numbered circles, the band, the foot and
  the narrow layout, from tokens only.

## 4. The browser suite

- [x] 4.1 `packages/server/e2e/harness-screenshots.spec.ts` drives the
  radios and measures the new rows.
- [x] 4.2 `packages/server/e2e/frame-screenshots.spec.ts` also writes
  `harness-settings-light.png` and `harness-settings-dark.png`, the whole tab
  at 1280 pixels.

  Record, 2026-09-16: the tab renders as the mockup's artboard in both themes,
  live against this repository (whose global file already names models) and
  in `harness-settings-light.png` / `harness-settings-dark.png`. Found while
  comparing and fixed here: the agent select cut "Claude CLI (ACP) — progress
  only, no permission gate" mid-word, so the option names the agent, the
  select's title keeps the label, and the caveat is one line under the table;
  a shell panel's own section margin doubled the grid gap in the Change
  Editor; the change view's segments wrapped in a narrow column, so a choice
  that wraps now keeps each segment's border, the band's columns are weighted
  toward the autonomy level, and "Inherit" names the choice while the note
  under it names the value and that it comes from the global file. At 640
  pixels each stage reads as a block of labelled fields, with no horizontal
  scroll. From the owner's check the same evening: "Not for:" ran on after
  the purpose as one paragraph, and is now a line of its own. The owner also
  looked for the mockup's warning callout on this repository's tab; it is
  shown only when core finds a ceiling that cannot act, which this
  repository's configuration has none of, and it appeared live, unsaved, as
  soon as apply was switched to Claude CLI.

## 5. Checks

- [x] 5.1 `openspec validate the-harness-settings-look-like-the-mockup
  --strict` passes.
- [x] 5.2 `npm run verify` passes, run unpiped. Record each package's count.
- [x] 5.3 A changeset: `@openspec-ui/webui` minor.
- [x] 5.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [x] 5.5 The whole standalone browser suite passes. Record the count.

  Record, 2026-09-16: `openspec validate --strict` valid. `npm run verify`,
  unpiped, after the last edit: typecheck and lint pass in every workspace;
  tests — root scripts 4 + 11 + 10 + 9 + 4, cli 161, core 1487 + 4,
  extension 379, server 103, webui 561 of 562. The one webui failure is
  `scripts/build-metro-icons.test.mjs`, the known Windows line-ending
  comparison of the generated icon module, which passes on Linux CI and is
  untouched here. `lint:english` (after `git add`), `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass. The
  whole standalone browser suite, after the last edit: 23 of 23 passed.

- [ ] 5.6 The editor's harness panels are seen at a narrow width, in the
  extension's screenshot spec or live, with each stage readable.
- [x] 5.7 **Human-only.** Whether `harness-settings-light.png` and
  `harness-settings-dark.png` match the mockup's "Harness Settings"
  artboards.

  Record, 2026-09-16: the owner compared the running site with the mockup —
  the standalone server on port 4317, built from the Harness Settings branch,
  which carries this change and the ones beneath it — rather than the
  pictures, and found it good: "As far as I'm concerned, everything is fine."

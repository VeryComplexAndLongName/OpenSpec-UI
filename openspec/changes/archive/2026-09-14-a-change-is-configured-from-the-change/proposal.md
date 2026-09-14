# A change is configured from the change, and a named configuration is chosen from a list

## Why

On 2026-09-13 the owner tried to set a change to `autonomous` and could not
find where to do it. Running "OpenSpec UI: Configure Harness for this
Change" from the Changes tree opened a view that showed, from the top:

- the global defaults, with an autonomy level that offers two values and
  never mentions that the third is set per change;
- four named configurations as bordered titles that read as headings, each
  followed by four paragraphs;
- "Save global config", with "Per-change override" directly beneath it and
  no boundary between the two;
- an empty text field for the change's name, although the command had been
  run on a change, and nothing else.

A review found this, not a test. It is two defects and three design faults.

- **The change the command was run on never reaches the form.**
  `openspec-ui.configureHarnessForChange` passes `changeName` to the AI
  panel. When the panel is newly opened, its first render carries the change
  name only inside the run plan, and there is no run plan here, so
  `HarnessSettingsView` mounts with an empty name. The name then arrives by
  message, and the effect calls `loadChangeOverride`. That function reads the
  form's own `changeName` state, which is still empty, so it returns without
  loading anything. The integration test checks the context the host posted,
  not what the view shows.
- **One change's configuration is edited on the page for the whole
  workspace.** ADR 0011 gives the configuration two levels: a global file and
  a per-change override. The view puts both on one screen with the global
  level first, and asks for the change by typed name. So a command named "for
  this Change" opens a page about everything.
- **Named configurations take up a screen and look like text.** There are
  four entries, each a bordered title followed by four paragraphs, and they
  appear in the global view, the change view and the run dialog. Nothing
  about a bordered title says that clicking it applies anything.
- **The run dialog reports an apply where it cannot be seen.** The standalone
  shell reports it in a message above the dialog; the editor reports it in a
  notification.
- **A recommendation drawn from the workspace's runs cannot be acted on.**
  "Fastest here" and "Most likely to finish" name agents, and nothing offers
  to use them. The owner had agreed to fix this in a deferred change ("make
  choosing obvious"). It is folded in here because it concerns the same
  picker and the same dialog.

## Capabilities

### New

- **A change's harness settings open from the change.**
  - Standalone: a `Harness` tab in the Change Editor, for the loaded change.
  - Editor: "Configure Harness for this Change" opens a panel belonging to
    that change and titled with its name.

  The change is known on the first render, and its override loads then.
- **A named configuration is chosen from a single list.** The list is a
  labelled select of the configurations the scope accepts. The recommended
  one is marked and selected. Beneath the list are the chosen configuration's
  effort, purpose, what it is not for and its basis, and an `Apply` button.
  What applying set is shown beside that button.
- **A change's settings show what each setting resolves to** where the
  change sets nothing, for example "inherit: claude-cli-acp, from the global
  file".
- **A recommendation drawn from the workspace's runs can be applied** from
  the run dialog, as `Use <agent> for every stage`.

### Modified

- "Harness Settings" (the standalone tab, and "Configure Harness Settings" in
  the editor) edits only the global file. Beside the autonomy level it says
  that `autonomous` is set for a single change.
- The run dialog uses the same named configuration picker, and says what
  applying wrote and where.
- A settings form enables its save control only when a field differs from
  what was loaded, and says when there are unsaved changes.
- The sections of a settings form are visibly separated.
- The AI panel no longer hosts the settings view.

## Impact

- `packages/webui`:
  - `HarnessSettingsView` is split into a global view and a change view;
  - a new `NamedConfigurationPicker`;
  - `RunDialog` and `WorkspaceRunStatsPanel`;
  - the Change Editor's tabs;
  - a new webview entry for the editor's settings panels;
  - the stylesheet.
- `packages/core`: a function that writes one agent to every stage of a
  change's override, beside `changeTemplateConfigToWrite`.
- `packages/extension`:
  - `HarnessSettingsPanel`, with one global panel and one panel per change;
  - the two configure commands;
  - the harness request operations, moved out of the AI panel;
  - a fifth bundle;
  - the run-choice handler's apply result.
- Documents, and the pictures they show: `HARNESS.md`, `LIMITS.md`,
  `openspec/README.md`, `packages/extension/README.md` and
  `docs/how-to/use-your-own-agent-definition.md`.

## Out of scope

- Changing what a named configuration contains, or adding a new one.
- The Pipeline card's controls, which open the same run dialog. They belong
  to `a-change-is-run-from-its-card`.
- The format of the configuration files.

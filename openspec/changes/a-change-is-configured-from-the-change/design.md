# Design

This design keeps ADR 0011's two levels of configuration, a global file and
a per-change override, and gives each level its own view. The views are
rendered from the same components in both hosts (ADR 0001). The editor
renders them in webviews, because a stage's picker needs to know what the
chosen agent accepts, and no native surface does (ADR 0003).

## Context

- **`HarnessSettingsView`** renders the whole configuration on one page: the
  findings, the global section (templates, stage fields, autonomy level,
  save), and a per-change section. The per-change section asks for the
  change's name in a text field and shows its form only after
  `Load override`.
- **`initialChangeName`** seeds that field's state once, when the view
  mounts. An effect keyed on the prop then calls `loadChangeOverride`, but
  that function reads the state, not the prop.
- **In the editor**, the view is mounted inside the AI panel when
  `showSettings` is true. `getBridgeHtml` writes `data-show-settings` into
  the first render, but the change name reaches the first render only inside
  `data-run-plan`, and a settings reveal has no run plan.
- **`HarnessTemplatePicker`** and `RunDialog` each render the four named
  configurations as a list of buttons, each followed by four paragraphs.
- **The run dialog applies a configuration** through `onApplyTemplate`.
  - The standalone shell writes the file, re-resolves the plan, and puts
    its message above the dialog.
  - The editor's run-choice handler writes the file, posts the new plan
    back, and shows an information notification.
- **`WorkspaceRunStatsPanel`** renders `recommendFromRunStats`'s offers as
  text.
- **Autonomy levels** come from core's `autonomyLevelsFor(scope)`: two for
  the global file and three for a change. A test pins them.

## Decisions

### Two views, each about one file

`GlobalHarnessSettingsView` edits the global file.
`ChangeHarnessSettingsView({ changeName })` edits one change's override. It
loads that override when it mounts and whenever the `changeName` prop
changes, and it always reads the prop, never a copy of it held in state.

Rejected:

- **Keeping one view and reordering its sections.** A command named "for
  this Change" would still show the workspace's settings, and it would stay
  unclear which file Save writes.
- **A change selector inside Harness Settings.** A change is configured from
  the change. A selector there would be the typed name in another form.

### Where each host puts the change view

- **Standalone:** a `Harness` tab in the Change Editor, beside proposal,
  design, tasks and spec. The Change Editor already has a loaded change, and
  a change's configuration is one of that change's files.
- **Editor:** a panel per change, titled `Harness: <change>`, and revealed if
  it is already open. This follows the timeline, which opens one panel per
  change.

Rejected:

- **The AI panel.** It is one panel doing several jobs, and it is where the
  name got lost.
- **One shared change panel that switches between changes.** With worktrees,
  two changes side by side are the ordinary case.

### The editor panels know their change when they first render

The panels render a new bundle, `dist/harness-settings.js`. The panel puts
the scope and the change name in the root element's data attributes, so the
first render already has them.

The `harness/*` and `custom-agents/list` request operations move out of the
AI panel into `answerHarnessRequest`, unchanged, and the settings panels use
it.

Rejected:

- **Delivering the name in a follow-up message.** That is the defect this
  change fixes.

### A named configuration is chosen from a list, and applied with one button

`NamedConfigurationPicker` has four parts:

- a `<select>` labelled `Named configuration`;
- the chosen configuration's effort, purpose, `Not for` and basis, beneath
  the select;
- an `Apply` button;
- a status line beside `Apply`.

Where a recommendation exists, the recommended configuration is marked and
selected first; otherwise the first configuration is selected. Changing the
selection changes the description and applies nothing.

Rejected:

- **The current list of buttons.** It reads as text and fills a screen.
- **Hiding the list behind a disclosure.** The owner suggested this. As a
  select, the list takes one line, so there is nothing left to hide.
- **Tabs or an accordion.** Either would make a reader page through four
  blocks of prose to make one choice. A select with its description shows
  the one configuration being considered.

### What applying did is said beside the control that did it

- **In a settings view,** Apply fills the fields and saves nothing, as it
  does today. The status line says what was set and that nothing is saved
  yet, using the existing `changeTemplateAppliedMessage`.
- **In the run dialog,** Apply writes the change's file, as it does today.
  The status line names the configuration and the file written, and the
  dialog shows the re-resolved plan.
- **In the editor,** no information notification is shown. The host posts
  the result back with the new plan.

Rejected:

- **Keeping the message above the dialog, or the notification.** Either is
  out of view at the moment the person needs it.

### A change's settings say what they inherit

Each `inherit` option names what the setting resolves to and where that
value comes from, computed with `mergeStepAgents` against the global file.
For example: `(inherit: claude-cli-acp, from the global file)`. Choosing
inherit still writes nothing for that setting.

Rejected:

- **Showing the resolved value as though the change set it.** A save would
  then write the value into the override, and the change would stop
  following the global file without anyone asking it to.

### Save is offered when there is something to save

In both views, the save button is disabled until a field differs from what
was last loaded or saved. While one does, `Unsaved changes` appears beside
the button.

### Sections are separated

Within a view, the named configuration block and the fields block are
separate sections. Each section ends with more space and a rule, so the
next heading is not read as belonging to the save control above it.

### A recommendation drawn from runs can be applied

Each offered recommendation shows one `Use <agent> for every stage` button
per agent it names. The button writes the change's override through a new
core function, `agentForEveryStageToWrite`, which sits beside
`changeTemplateConfigToWrite` and keeps every key it does not set. After a
write, the dialog re-resolves its plan.

This appears only in the run dialog, where there is a change to write to.

Rejected:

- **Offering it in the global view.** A workspace-wide recommendation,
  applied there, would change every change that inherits from the global
  file, without anyone asking about those changes.

## Protocol

No command or event changes.

- **Request operations:** the editor's `harness/*` and `custom-agents/list`
  move from the AI panel to the settings panels, with the same shapes.
- **Webview messages:** the settings entry posts one new message,
  `openspec-ui/edit-global-harness`. The run-choice handler gains
  `{ kind: "use-agent", agentId }`.
- **Standalone routes:** unchanged.

## Non-Goals

- Changing any named configuration, or adding one.
- A confirmation before leaving a form with unsaved changes.
- The Pipeline card's Start, which opens the same run dialog.
- The configuration files' format.

## Risks / Trade-offs

- **The per-change section is gone from Harness Settings.** A person used to
  finding it there will look there first. The global view says where a
  change's settings now are.
- **A fifth bundle** adds about 1.3 MB to the extension package, as the
  timeline bundle already does.
- **Documentation pictures and sections change.** `HARNESS.md` is where a
  reader learns where each key is edited, so its table is rewritten in this
  change rather than later.
- **Readiness will report a collision with `a-change-is-run-from-its-card`.**
  That change also renders `RunDialog`, and both deliver a `shared-ui` delta.
  Whichever lands second adapts to the dialog's new picker.

Global settings and one change's settings become two views, each opened
where it belongs; named configurations are chosen from one list; a
recommendation from runs can be applied (owner review, 2026-09-13).

## 1. Two views, each about one file

- [ ] 1.1 `packages/webui/src/components/GlobalHarnessSettingsView.tsx`
  holds the global part of today's `HarnessSettingsView`: the stage agent,
  effort, budget and custom agent fields, the autonomy level, the fixed
  review gate, and the findings. It reads and writes only through
  `resolveGlobal` and `writeGlobal`. It has no change name field and no
  per-change section.
- [ ] 1.2 `packages/webui/src/components/ChangeHarnessSettingsView.tsx`
  exports `ChangeHarnessSettingsView({ api, changeName, onEditGlobal })`.
  It loads the change's override when it mounts and each time the
  `changeName` prop changes, reading the prop directly. Do not copy the prop
  into state and read the copy: that is the defect this change fixes. The
  view has no change name field.
- [ ] 1.3 `packages/webui/src/components/HarnessSettingsView.tsx` is removed.
  Its tests move to the test files of the two views, and every existing
  assertion stays with the view it is about.
- [ ] 1.4 The global view's autonomy level shows this beside its select:
  `autonomous — a chain with no confirmations — is set for a single change, in that change's harness settings.`
  A test pins the sentence.
- [ ] 1.5 In the change view, the `inherit` option of each stage's agent
  select names what the setting resolves to, using `mergeStepAgents`
  against the global file: `(inherit: claude-cli-acp, from the global file)`.
  Effort, budget, custom agent, autonomy level and review gate do the same
  wherever the global file sets them. Choosing inherit writes nothing for
  that field, as today.
- [ ] 1.6 The change view offers an `Edit global defaults` control, which
  calls `onEditGlobal`.
- [ ] 1.7 In both views, the save control is disabled until a field differs
  from what was last loaded, applied or saved. While a field differs,
  `Unsaved changes` is shown beside the control. After a save, the control
  is disabled again.
- [ ] 1.8 The findings block ("What this configuration cannot do") comes from
  the global file in the global view, and from what the change resolves to
  in the change view.

## 2. A named configuration chosen from a list

- [ ] 2.1 `packages/webui/src/components/NamedConfigurationPicker.tsx`
  exports `NamedConfigurationPicker({ scope, recommendedId, describeEffort, onApply })`.
  It renders:
  - a `<select>` labelled `Named configuration`, listing
    `templatesForScope(scope)`. The recommended configuration is titled with
    `(recommended)` and selected first, where there is one.
  - beneath it, the selected configuration's effort, intent, `Not for` and
    basis, which change with the selection;
  - an `Apply` button, which calls `onApply` with the selected
    configuration.
- [ ] 2.2 Beside `Apply`, the picker shows a `role="status"` line with the
  text its host returns for the last apply. The line clears when the
  selection changes.
- [ ] 2.3 The global view and the change view both use the picker. The
  message `changeTemplateAppliedMessage` produces, and the global view's
  equivalent, appear in that status line, not at the top of the view.
  Applying saves nothing, as today.
- [ ] 2.4 `RunDialog` replaces its `run-dialog-templates` list with the
  picker. It passes `effortNote` for the plan's agents as `describeEffort`,
  and the advice's template id as `recommendedId`.
- [ ] 2.5 Standalone: `applyTemplateToChange` in `standalone-entry.tsx`
  returns its result to the dialog's status line, naming the configuration
  applied and the file written, `openspec/changes/<change>/harness.json`.
  It no longer sets the message above the dialog.
- [ ] 2.6 Editor: the run-choice handler in
  `packages/extension/src/commands.ts` posts the same result back, with the
  re-resolved plan, as `AiPanelContext.appliedNote`. It no longer shows an
  information notification.
- [ ] 2.7 `HarnessTemplatePicker` is removed.

## 3. The change view's place in each host

- [ ] 3.1 Standalone: the Change Editor's editor tabs gain `Harness` after
  `spec`.
  - When a change is loaded, the tab renders `ChangeHarnessSettingsView` for
    it.
  - When no change is loaded, it says `Load a change to configure it.`

  `onEditGlobal` switches to the Harness Settings tab.
- [ ] 3.2 Standalone: the Harness Settings tab renders
  `GlobalHarnessSettingsView`, and says beneath its heading:
  `A change's own settings are in the Change Editor, under Harness.`
- [ ] 3.3 Editor: a new `HarnessSettingsPanel`, in
  `packages/extension/src/webview/harness-settings-panel.ts`, has two
  methods:
  - `showGlobal()` opens a single panel per window, titled
    `OpenSpec UI: Harness Settings`.
  - `showChange(changeName, changeDir)` opens one panel per change, titled
    `Harness: <change>`, and reveals that panel if it is already open.

  Each panel renders `dist/harness-settings.js`. The panel puts its scope
  and change name in the root element's data attributes, so the first
  render already has them.
- [ ] 3.4 `packages/webui/src/harness-settings-entry.tsx` reads the scope and
  change name from the root element, and renders either the global view or
  the change view. Its `onEditGlobal` posts `openspec-ui/edit-global-harness`,
  and the panel answers by calling `showGlobal()`.
- [ ] 3.5 `harnessSettingsWebviewBuildOptions` in
  `packages/extension/scripts/build-options.mjs` bundles the entry to
  `dist/harness-settings.js`, and `packages/extension/scripts/build.mjs`
  builds it. Record the bundle's size.
- [ ] 3.6 A new file, `packages/extension/src/webview/harness-requests.ts`,
  holds `answerHarnessRequest`: the `harness/*` and `custom-agents/list`
  answers, moved unchanged from `answerRequest` in `ai-panel.ts`. The
  settings panels use it, and the AI panel no longer offers those
  operations.
- [ ] 3.7 `openspec-ui.configureHarness` calls `showGlobal()`.
  `openspec-ui.configureHarnessForChange` seeds the change's empty override
  as it does today, then calls `showChange`. Neither command reveals the AI
  panel.
- [ ] 3.8 `showSettings` is removed from `AiPanelContext`,
  `DashboardContext`, the attributes `getBridgeHtml` writes, and
  `extension-entry.tsx`, together with the branch that mounted the settings
  view.

## 4. Sections separated

- [ ] 4.1 In `packages/webui/src/shell-ui.ts`, the named configuration block
  and the fields block are separate `.openspec-harness-section` elements.
  Each section ends with a rule and more space than separates the fields
  inside it. `shell-ui.test.ts` pins the rule.
- [ ] 4.2 The browser suite measures, in both views, that the gap between the
  picker's status line and the first field is larger than the gap between
  two fields.

## 5. A recommendation drawn from runs, applied

- [ ] 5.1 `agentForEveryStageToWrite(override, agentId)` in
  `packages/core/src/harness-templates.ts`, beside
  `changeTemplateConfigToWrite`, returns the change's override with every
  configurable stage set to that agent. It removes an effort or a custom
  agent the new agent does not accept, and keeps every other key unchanged.
  Export it from `browser.ts` and `index.ts`.
- [ ] 5.2 `WorkspaceRunStatsPanel` takes `onUseAgent?: (agentId: string) => void`.
  When it is given, each recommendation that `recommendFromRunStats` offers
  shows one `Use <agent> for every stage` button per agent the
  recommendation names. `RunDialog` passes `onUseAgent`; the settings views
  do not.
- [ ] 5.3 Both hosts write through `agentForEveryStageToWrite`, show beside
  the button what was written and where, and re-resolve the dialog's plan.
  - Standalone: the write goes through the same route
    `applyTemplateToChange` uses.
  - Editor: the write is a run choice, `{ kind: "use-agent", agentId }`.
    The handler checks the id against the agent registry before writing
    anything, and writes nothing for an unknown id.

## 6. Tests

- [ ] 6.1 webui `ChangeHarnessSettingsView.test.tsx`:
  - mounted with a change name, the view reads that change's override once;
  - re-rendered with another name, it reads the other change's override;
  - there is no change name input;
  - each inherit option names the global value;
  - save is disabled until a field changes, and `Unsaved changes` shows
    while one does.
- [ ] 6.2 webui `GlobalHarnessSettingsView.test.tsx`: the autonomy level
  offers two values and shows the note; the view has no per-change section.
- [ ] 6.3 webui `NamedConfigurationPicker.test.tsx`:
  - the recommended configuration is selected first;
  - changing the selection changes the description and clears the status
    line;
  - `Apply` calls `onApply` with the selected configuration.
- [ ] 6.4 webui `RunDialog.test.tsx`:
  - the picker replaces the list;
  - the status line shows the result the host returns;
  - a recommendation's `Use` button calls `onUseAgent`.
- [ ] 6.5 extension `harness-settings-panel.test.ts`:
  - `showChange` twice for one change leaves one panel;
  - `showChange` for two changes opens two panels;
  - each panel's HTML carries its scope and change name;
  - `openspec-ui/edit-global-harness` opens the global panel.
- [ ] 6.6 In the extension integration suite,
  `packages/extension/src/test/suite/extension.test.ts`: running
  `openspec-ui.configureHarnessForChange` on `demo` opens a panel titled
  `Harness: demo`, and within 10 seconds the webview's first request is
  `harness/read-change-override` for `demo`. This replaces the test that
  checked only the posted context.
- [ ] 6.7 core `harness-templates.test.ts`: `agentForEveryStageToWrite` sets
  every stage, removes an effort the agent does not accept, and keeps
  unrelated keys.
- [ ] 6.8 extension `commands.test.ts`: `use-agent` with a registered agent
  writes the override; with an unknown id it writes nothing and logs the
  id.

## 7. Documents and pictures

- [ ] 7.1 `packages/server/e2e/harness-screenshots.spec.ts` captures three
  pictures, and each one is looked at:
  - `harness-settings.png`, showing the global view only;
  - `harness-change-override.png`, from the Change Editor's Harness tab,
    with the picker's description visible;
  - `run-dialog.png`, with the picker.
- [ ] 7.2 `packages/extension/e2e/editor-screenshots.spec.ts` captures two
  pictures into `docs/images/vscode/`: `harness-settings.png` and
  `harness-change.png`, of the two panels, each opened by its own command.
  `npm run lint:screenshots` passes, and both pictures are looked at.
- [ ] 7.3 These documents say where each view now is:
  - `HARNESS.md`: the table that names where each key is edited, and the
    two picture sections;
  - `LIMITS.md`: the budget input;
  - `openspec/README.md`: "Three ways to edit either file";
  - `packages/extension/README.md`: the two configure commands;
  - `docs/how-to/use-your-own-agent-definition.md`: step 2.

## 8. Verification

- [ ] 8.1 This change validates strictly. `check(validate-change)`
- [ ] 8.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and the test count for each package.
- [ ] 8.3 A pending changeset exists: webui, extension and core minor,
  server patch. `check(changeset-present)`
- [ ] 8.4 Run the whole browser suite, not a selected spec.
- [ ] 8.5 Run the extension integration suite (`npm run test:integration` in
  `packages/extension`), with the inherited `VSCODE_*` and `ELECTRON_*`
  variables stripped. Record the run.
- [ ] 8.6 **Human-only**: check the new flow by hand, from three places:
  - in VS Code, run `Configure Harness for this Change` on a change;
  - in the standalone shell, open the Change Editor's `Harness` tab;
  - open the run dialog.

  In each place, set the change to `autonomous` where the place offers it,
  and apply a named configuration. Say whether it was obvious where to look
  and what to press.

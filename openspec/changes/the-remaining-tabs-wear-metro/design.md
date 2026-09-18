## Context

`shell-ui.ts` carries two layers at once. The redesigned one —
`openspec-panel` with `openspec-panel-head`, `-body`, `-fine`, `-empty`,
`openspec-controls`, `openspec-table`, `openspec-tile`, `openspec-segmented`,
`badge` — is what the Summary, Harness Settings, both Timeline screens and
the Pipeline draw with. The pre-redesign one — `openspec-shell-panel`,
`openspec-shell-grid`, `openspec-shell-field`,
`openspec-ai-panel-controls`, `openspec-overview-table`,
`openspec-editor-tabs`, `openspec-editor-grid` — is what the five remaining
tabs still draw with.

Every tab already has its page head (`page-heads.ts`), its `PanelStatus`
and its `BusyFieldset`: step 2 gave them that. What is missing is inside.

The Run tab is not only a tab. `extension-entry.tsx` renders `AiPanel`,
`RunDialog` and `HarnessChainPanel` in the extension's AI panel webview,
and `shell-ui.ts`'s editor layer names their current classes —
`.openspec-extension-app .openspec-shell-panel`, `.openspec-ai-panel`,
`.openspec-status-card`, `.openspec-data-card`, `.openspec-diff-body`,
`.openspec-overview-table` — once for the editor's colours and again under
`forced-colors`.

## Goals / Non-Goals

**Goals:**

- The five tabs read as the same product as the redesigned screens.
- Nothing a test, a spec or the extension drives these screens by changes:
  testids, accessible names and roles stay.
- The editor keeps the editor's colours, proved by the mapping test rather
  than by a screenshot.

**Non-Goals:**

- **A mockup.** These tabs have none; the shared components decide the
  shape, and the owner looks at the captures.
- **New behaviour.** Nothing gains a control, a reading or a state. Where a
  list is drawn as a table, the same values are in it.
- **Removing the pre-redesign classes from the stylesheet.** Some are still
  worn by the run dialog's smaller parts and by the extension's own layer;
  the class list is pruned when nothing wears it, not before.

## Decisions

### One panel per thing the tab is about, and one toolbar

Each tab becomes a panel per subject — Run: the workspace and the run;
Processes: the persisted runs and the details of the one selected;
Diff: the diff; Editor: the change's documents and its harness; Templates:
one panel per category and one for the selected template — with the tab's
controls in a single `openspec-controls` row above them.

A section that owns an action keeps that action in its own head or foot
(`openspec-panel-head` takes a note and a control, as Harness Settings
shows), rather than in a second toolbar at the top.

**Rejected: leaving each tab as one panel.** That is what they are now, and
it is why a heading has nowhere to go.

### The markup changes; the handles do not

Every `data-testid`, every `aria-label`, every accessible name and every
role stays exactly as it is. The browser specs and the component tests are
the reason: `ProcessesView.test.tsx`, `AiPanel.test.tsx`,
`RunDialog.test.tsx`, `HarnessChainPanel.test.tsx` and the seven browser
specs that drive these tabs read them by name and by testid, and a re-skin
that renamed a handle would be a behaviour change wearing a stylesheet's
clothes.

Two consequences follow. The command kind stays a `select` rather than
becoming a segmented control, because `AiPanel.test.tsx` and the browser
specs pick its options by name. And `ChangeDiff`'s
`.openspec-diff-line--*` classes stay, because `ChangeDiff.test.tsx` reads
them.

**Rejected: taking the chance to tidy the handles too.** A change that
moves the markup and the handles at once cannot say which of the two broke
a spec.

### The editor override list moves with the classes

Where a class the editor layer names is replaced, the layer's rule is moved
to the new class in the same commit, in both the ordinary block and the
`forced-colors` block. `vscode-metro-mapping.test.ts` and
`shell-ui.test.ts` fail on a token the editor layer leaves unset, which is
what makes this checkable rather than hopeful.

The AI panel is the case that matters: it is the Run tab's markup inside
the editor.

### The pictures are the evidence

ADR 0033 decision 8 says each of these changes shows the owner its
captures. `documentation-screenshots.spec.ts` already captures all five
tabs into `docs/images/standalone/`, so the change retakes those rather
than adding a second capture of the same screens.

That spec reaches the harness row through
`page.locator("div", { has: getByTestId("run-with-harness-button") }).last()`,
which is a locator written against the current nesting. It becomes a
testid on the row itself, since this change moves that nesting.

## Risks / Trade-offs

- **Seven browser specs drive these tabs.** They are driven by role and
  testid, which this change keeps; the whole suite is run before the change
  is done, not only the specs it touched.
- **The extension's AI panel wears the Run tab's classes.** The override
  list moves in the same commit and the mapping test gates it; the live
  check in the Extension Development Host is a task of this change.
- **A re-skin can lose an accessible name by accident** — a heading that
  becomes a panel head, a note that becomes fine print. The axe pass in
  `standalone.spec.ts` covers the Change Editor, and the component tests
  read names rather than classes.
- **The two layers live side by side for another change.** Nothing forces
  the old classes out until nothing wears them; the stylesheet keeps both
  until then, which is a page weight cost measured in bytes, not a
  behaviour.

## Protocol

No command, event or route changes. This change moves markup and
stylesheet rules only.

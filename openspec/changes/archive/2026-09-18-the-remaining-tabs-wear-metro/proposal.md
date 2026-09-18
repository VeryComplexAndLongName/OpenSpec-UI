## Why

ADR 0033 decision 8 lists the order the standalone shell is redrawn in, and
step 6 is the last of it: "The remaining tabs — Run, Processes, Diff,
Editor, Templates and the Pipeline — adopt the shared components. They have
no mockup; each change shows the owner its captures."

The Pipeline went with `the-pipeline-cards-wear-metro`. The five tabs did
not, and a reading of them on 2026-09-18 says how far behind they are:

- **None of the five has a panel head.** Each is one borderless
  `openspec-shell-panel` with fields dropped into it, while every redesigned
  screen names its panel and puts a note beside the name.
- **Every control row is `openspec-ai-panel-controls`**, the pre-redesign
  class, rather than the `openspec-controls` toolbar the Summary, the
  Timeline and Harness Settings share. The Change Editor has three such
  rows and no toolbar at all.
- **Two tables are `openspec-overview-table`**, the old class, in Processes
  and Templates; the redesigned screens use `openspec-table`.
- **A heading sits loose in four places** — `Run analysis`, the Processes
  details block's `h3`/`h4`, the selected template's `h3`, the run dialog's
  `h3` — where the redesigned screens have a panel head.
- **The Change Editor rolls its own tab strip**, `openspec-editor-tabs` with
  an `.is-active` modifier, which is `openspec-segmented` written before
  `openspec-segmented` existed.
- **State reads as prose.** A process's state, a template's origin and
  whether it is customized are plain text where the redesigned lists carry
  a badge.
- **Empty means nothing is drawn.** Templates renders nothing at all before
  Load is pressed; Processes and Diff say their empty in a loose note rather
  than in the panel.

## What Changes

- **Each of the five tabs is one or more `openspec-panel`s** with a head
  that names it, a body, and the fine print in `openspec-panel-fine`.
- **Each tab's controls sit in one `openspec-controls` toolbar**, as the
  redesigned screens do. The Change Editor's three rows become one toolbar
  and a per-section row where a section owns its own action.
- **The two old tables become `openspec-table`** inside their panels, and
  Templates' category rows become a panel per category rather than a
  `colspan` sub-header.
- **A state or an origin becomes a badge**: a process's state, a template's
  built-in or project origin and its customized mark.
- **The Change Editor's tab strip becomes `openspec-segmented`**, the
  control the Timeline's modes already use.
- **An empty list says so inside its panel**, including Templates before
  anything is loaded.
- **The editor keeps the editor's colours.** The extension's AI panel draws
  the Run tab's markup, so the `.openspec-extension-app` override list moves
  with the classes, and the mapping test is what proves it.
- **The pictures are retaken.** `documentation-screenshots.spec.ts` already
  captures all five tabs; its fragile locator for the harness row is
  replaced by a testid, and the six pictures under
  `docs/images/standalone/` are regenerated for the owner to look at.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `standalone-app`: every tab is drawn from the shared components, not only
  the ones a mockup drew.

## Impact

- **`packages/webui`**: `src/standalone-entry.tsx` (the Run, Processes,
  Diff, Editor and Templates tabs), `src/components/AiPanel.tsx`,
  `ProcessesView.tsx`, `ChangeDiff.tsx`, `RunDialog.tsx`,
  `HarnessChainPanel.tsx`, and `src/shell-ui.ts` for the rules and the
  editor override list; the component tests that read the markup.
- **`packages/server/e2e`**: `documentation-screenshots.spec.ts` and the six
  pictures it writes.
- **Unchanged**: every testid and accessible name the specs and the
  extension drive these screens by, the Pipeline, the Timeline, the Summary
  and Harness Settings.

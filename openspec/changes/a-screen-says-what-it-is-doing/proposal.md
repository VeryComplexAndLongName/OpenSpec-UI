## Why

Three things the owner reported about the standalone shell on 2026-09-16, all
older than the Metro work.

- **Diff Preview has never shown anything of theirs.** Checked live against
  their running server: the tab renders a hard-coded two-line sample,
  `- [ ] task one` becoming `- [x] task one`, and it reads the same after four
  seconds as it does immediately. There is no data path at all —
  `standalone-entry.tsx` passes those two strings to `ChangeDiff` as literals.
- **Switching to a slow tab shows an empty screen.** A loading word exists
  where a button starts the work — the summary, the editor, templates, the
  timeline, the comparison, the processes refresh — and the Pipeline says
  "Reading what is running…". A tab that fetches when it first mounts says
  nothing, so a person waits at a blank panel with no way to tell working
  from broken.
- **The theme button never changes its name.** That one is deliberate:
  `the-web-ui-wears-metro` fixed the label at "Dark theme" and put the state
  in `aria-pressed`, because WCAG 2.5.3 requires the visible label to be part
  of the accessible name. The reading is still fair — the control does not
  look like it has two states.

## What Changes

- **Diff Preview shows a real diff.** A new token-gated route,
  `POST /api/change-diff`, returns what git reports for a chosen change's own
  folder, and the tab lets a person pick among the active changes. A change
  with nothing uncommitted says so in words.
- **A tab that is reading says so, visibly, and holds its controls.** While a
  tab reads — on opening, or from one of its own buttons — it shows a moving
  bar and a spinner beside one `role="status"` sentence naming what it
  reads, with the seconds elapsed once the wait is noticeable; its controls
  are disabled; and its label in the tab row carries a small spinner, so a
  tab left while it reads still shows it is busy. The owner reviewed this as
  the third screen of the redesign mockup on 2026-09-16 and approved it; an
  earlier draft of this change had rejected a spinner, and that decision is
  reversed below.
- **The theme control becomes a switch.** Its visible label stays "Dark
  theme", its state is carried by `role="switch"` and `aria-checked`, and an
  icon changes with it, so the two states are visible as well as announced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `standalone-app`: a tab that fetches on first mount says so, and Diff
  Preview shows a change's real diff instead of a sample.
- `shared-ui`: the theme control is a switch whose visible name does not
  change.

## Impact

- **`packages/server`**: `src/rest.ts` gains `handleChangeDiffRequest`, and
  `src/server.ts` routes `POST /api/change-diff` to it, token-gated like
  every other route.
- **`packages/core`**: `src/change-diff.ts` (new), `readChangeDiff`. A
  plain `git diff` shows only unstaged edits, so a change's new files and
  staged work need their own reading.
- **`packages/webui`**: `src/change-diff-client.ts` (new),
  `src/components/ChangeDiff.tsx` (renders a unified diff),
  `src/tab-readings.ts` (new), `src/components/PanelStatus.tsx` (new),
  `src/components/BusyFieldset.tsx` (new), `src/components/Tabs.tsx`,
  `src/components/ProcessesView.tsx`,
  `src/components/GlobalHarnessSettingsView.tsx`,
  `src/components/PipelineView.tsx`, `src/components/ThemeToggle.tsx`,
  `src/shell-ui.ts`, and the tabs in `src/standalone-entry.tsx`.
- **`packages/extension`**: nothing but the bundles it rebuilds.

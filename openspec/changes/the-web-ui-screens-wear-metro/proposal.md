## Why

ADR 0032, second half. `the-web-ui-wears-more-metro` brings the panels, cards,
badges, Metro's timeline, the icon set and the hue-and-ink palette into the web
UI without changing a single screen. This change spends them.

It is separated deliberately. Everything in the first change is settled by a
test; everything here has to be looked at, and a headless run cannot tell
whether a section's icon helps or merely decorates.

## What Changes

- **Harness Settings becomes panels.** Each section is a Metro `.panel` whose
  `.panel-title` holds the section's name and its icon, with ADR 0023's
  two-column name-and-value rows unchanged inside.
- **A change's history becomes Metro's timeline.** The per-change view lists
  tasks as `.timeline` items, the date in `.time` and the text in `.data`.
- **Several changes read as one picture over one axis of time.** The
  multi-change view becomes a grid — a sticky change column, a day axis, and
  event blocks placed by `grid-column` — in the shape the project site's
  Release History uses. The log-scaled lanes go: a reader could not turn a
  position back into a date.
- **The summary shows tiles,** each a coloured square with an icon, a label
  and a figure, and a change's state word becomes a badge.
- **Repeated actions carry an icon** before their label: start, stop, refresh,
  review, archive, open.
- **The shell's own rules for what Metro now draws are removed**, so one
  arrangement is not drawn by two stylesheets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: a block that is a separate object of its own may be drawn as a
  card or a panel, while a heading, a navigation strip and a list row may not.

## Impact

- **`packages/webui`**
  - `src/components/GlobalHarnessSettingsView.tsx`,
    `ChangeHarnessSettingsView.tsx`, `ChangeTimelineView.tsx`,
    `MultiChangeTimelineView.tsx`, `ChangesList.tsx`, `ProcessesView.tsx`,
    `PipelineView.tsx`;
  - `src/standalone-entry.tsx`: the summary blocks;
  - `src/shell-ui.ts`: the history grid arrives, and the rules the Metro
    families replace are removed.
- **`packages/extension`**: the same webviews, rebuilt.
- **Unchanged**: the Pipeline picture's geometry (ADR 0025), the change
  editor, diffs and the AI panel.

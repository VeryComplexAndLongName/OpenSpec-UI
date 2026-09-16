## Why

ADR 0033, accepted on 2026-09-16. The owner compared the running shell with
the approved mockup (https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L) and
found an old design with tiny changes: #535 to #539 added Metro classes to a
few screens and left the shell's own stylesheet — its palette, its header,
its tab strip, its page width — as it was. This is the second step of the
ADR's delivery order, after the dark theme was drawn and approved: the frame
and the shared components, so every tab takes the new look before any single
screen is redrawn.

## What Changes

- **The palette becomes the project site's**, in light and dark, under the
  shell's existing token names, with three new ones: `--heading`, `--link` and
  `--tab-accent`. The hues a coloured block uses become the site's Metro
  hues. The site's subtle grey is darkened to `#646a74`, which passes AA on
  every ground.
- **The frame.**
  - **An application bar** across the page: the owl, "OpenSpec UI", the
    workspace path and the theme switch.
  - **A page head** above the tabs: a tagline with an icon, the open tab's
    title, and the sentence that used to sit under each tab's heading.
  - **One row of tabs** with short labels — Run, Processes, Diff, Summary,
    Editor, Templates, Timeline, Pipeline, Harness — underlined when current.
    Each keeps its full name as its accessible name.
  - **A 1180-pixel page** instead of 980, and a footer carrying the versions.
- **The shared components as `openspec-` classes**, drawn from the tokens:
  the panel with a head and fine print, the KPI tile, the table, the
  segmented control, the controls bar and the notice. This change restyles
  the existing tab panel and summary tiles with them; the screens that
  adopt the rest are the later changes of ADR 0033.
- **VS Code** maps the three new tokens onto the editor's theme and takes no
  part of the frame.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `standalone-app`: the shell has a frame — an application bar, a page head,
  one row of short-labelled tabs and a footer.

## Impact

- `packages/webui`: `src/shell-ui.ts` (tokens, frame and component rules),
  `src/host-embed.ts` (short labels), `src/components/Tabs.tsx`,
  `src/components/AppBar.tsx` (new), `src/components/PageHead.tsx` (new),
  `src/page-heads.ts` (new), `src/standalone-entry.tsx`, and their tests.
- `packages/server/e2e`: specs that find a tab by the heading it used to
  carry, or wait on the "OpenSpec UI" level-one heading, find it by its panel
  or the application bar instead; a new spec captures the frame in both
  themes. Every standalone picture is taken again.
- ADR 0033 is added by this change.

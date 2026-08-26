## Context

The user explicitly asked for both timeline phases to be designed
together with a shared data layer (delivered in Change 1) and for a
logarithmic time axis "from the start," without specifying which
direction. The plan for this change flagged the log-scale direction as
the one piece worth sanity-checking against real data before writing
it into a spec, rather than locking in a formula blind.

## Goals / Non-Goals

**Goals:**
- Several changes' activity is comparable side by side on one shared
  axis, with a log scale chosen for a concrete, verified reason (not
  "log scale sounds sophisticated").
- No new charting library or canvas/SVG rendering — plain CSS
  positioning (`left: X%`), per the explicit request to avoid heavy
  chart infrastructure.
- Reuses Change 1's data layer and Change 2's `ChangeTimeline` type
  completely unchanged.

**Non-Goals:**
- Not building collision/overlap avoidance for near-simultaneous points
  within a lane (e.g. nudging overlapping dots apart). The log-scale
  fix already addresses the primary practical case (a dense
  squash-merge cluster) by spreading it out — see the empirical check
  below. Minor residual overlap for genuinely simultaneous points is
  accepted for this first version rather than adding a general
  collision-layout algorithm.
- Not adding a manual date-range text input to the VS Code extension's
  Command Palette flow — no native date picker exists in VS Code's own
  prompt UI, and typed ISO-date entry is worse UX than deriving a
  sensible default from the data itself (see Decisions).

## Decisions

### Log-scale direction: from the range start, confirmed empirically

Before writing any component code, real timestamps from this
repository's own archived changes (spanning 2026-08-26, 09:04 through
20:03, including a dense 8-change cluster between 09:04 and 11:03 —
this repository's own squash-merge workflow, exactly the case earlier
discussion in this session flagged as the common outcome) were plotted
under three candidate scales in a throwaway HTML/Playwright sketch:
linear, `log1p(elapsed since range start)`, and `log1p(remaining time
until range end)`. The "from start" direction visibly spread the dense
morning cluster into distinguishable points; "from end" compressed the
same cluster *tighter* than even the linear baseline, defeating the
purpose. `logPosition` (`timeline-scale.ts`) implements the "from
start" direction:

```
raw = (log1p(elapsed) / log1p(span)) * 100, clamped to [0, 100]
```

### Extension global command derives its date range from the data, not user input

`computeDefaultRange` (`commands.ts`) takes the earliest/latest
determinable date across every selected change's created/task/archived
dates. This avoids a manual ISO-date-entry prompt (VS Code's
`showInputBox` has no date-picker affordance) while still producing a
sensible, data-driven range. The standalone app's web UI *does* offer
real `<input type="date">` pickers (a browser-native control VS Code's
prompt API doesn't have), so this asymmetry is a genuine capability
difference between the two hosts, not an inconsistency to paper over.

### `archivedDate` is anchored to end-of-day, not midnight

Found during this change's own verification (a real-browser smoke test
against real archived-change data): `archivedDate` is a plain calendar
date parsed from the archive folder name, with no time-of-day
information. Anchoring it to midnight (`T00:00:00.000Z`) made it
plot — and sort into the default range — *before* that same day's
actual `createdDate`/task timestamps, even though archiving is
chronologically the *last* thing that happens to a change. Anchored to
end-of-day (`T23:59:59.999Z`) instead, in both
`MultiChangeTimelineView.tsx`'s point-building and `commands.ts`'s
`computeDefaultRange`.

### Timeline CSS was missing entirely — added as part of this change

Also found during verification: neither this change's nor Change 2's
timeline components had any matching CSS in `shell-ui.ts`. For Change
2's single-change view this was a cosmetic gap (default HTML element
styling made it readable regardless). For this change's positioned-dots
layout it was a functional one — `left: X%` inline styles do nothing
without `position: relative` on the track and `position: absolute` on
each point, so the axis did not visually exist at all beforehand. Added
`.openspec-timeline-*` and `.openspec-multi-timeline-*` rules to
`shellThemeCss`, matching the existing CSS-variable palette
(`--surface`, `--surface-2`, `--line`, `--ink`, `--muted`, `--primary`,
`--danger`).

## Risks / Trade-offs

- **[Risk]** A smoke test against the bundled `dist/timeline.js` in a
  bare browser page (not a real VS Code webview) showed the new track/
  point CSS resolving to transparent colors, because `vscodeThemeCss`'s
  `:root` rules (which come after `shellThemeCss` in the concatenated
  stylesheet and win) reference `--vscode-*` custom properties that
  only exist inside a real VS Code webview, not a plain browser page.
  → **Mitigation**: confirmed via computed styles that `position`/
  `left`/`transform` (the actual functional positioning) resolved
  correctly regardless; the missing color is a known, pre-existing
  limitation of this lightweight smoke-test technique (already true for
  `AiPanel`'s own styling, not something introduced by this change),
  not a defect inside a real VS Code window, where `--vscode-*`
  variables are genuinely defined by the host.

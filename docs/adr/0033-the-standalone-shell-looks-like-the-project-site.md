# 0033: The Standalone Shell Looks Like the Project Site

Status: Accepted

Date: 2026-09-16

Supersedes decision 1 of [0023](0023-standalone-shell-visual-direction.md)
for the standalone shell, and decision 4 of
[0032](0032-the-standalone-shell-uses-more-of-metro.md). Decisions 2 to 5 of
0023, and 0030's scoped copy of Metro's controls, stand.

## Context

The owner asked on 2026-09-16 for the standalone shell to look like the
project site `OpenSpec-UI-Homepage`. ADR 0032 answered that by bringing more
of Metro UI 5.1 in — panels, badges, a timeline, icons — and three changes
shipped it (#535, #537, #539). The owner's reading of the result, the same
day: "an old design with tiny changes".

**Why that happened.** The site's look is not Metro's. Read on 2026-09-16:
the site takes Metro's reset, its font stack, `button`, `badge`, `table` and
its icons, and draws everything that makes it look like itself with its own
378-line `home.css` and 218-line `stats.css`, under an `os-` prefix: the
56-pixel header bar, the page head with a tagline and a light 32-pixel title,
the tab bar underlined in red, white panels with a one-pixel border, six-pixel
corners and a faint shadow on a `#f4f5f7` ground, KPI tiles with a coloured
icon block, segmented controls, a controls bar, and a yellow notice. ADR 0032
added Metro classes to the screens and left the shell's own 2,050-line
`shell-ui.ts` — the thing that actually decides how the screens look — as it
was.

**What the owner approved.** A mockup of five screens drawn in the site's
look, from the site's own CSS values and this repository's real data:
the summary, Harness Settings, a tab that is reading, a change's timeline,
and the comparison of changes (https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L,
approved on 2026-09-16: "all three mockups are liked", and the two timelines
after them). The third of them is already built, by
`a-screen-says-what-it-is-doing`.

**What the site's palette does against this project's gate.** Measured with
the WCAG formula on 2026-09-16:

| Pair | Ratio |
| --- | --- |
| text `#3c4048` on surface `#ffffff` | 10.40 |
| heading `#16181d` on ground `#f4f5f7` | 16.28 |
| muted `#6b717b` on surface / on ground | 4.91 / 4.50 |
| **subtle `#767c86` on surface / on ground / on footer `#e9ebef`** | **4.20 / 3.85 / 3.52** |
| accent `#0a6ebd` on surface | 5.28 |
| white on cobalt `#0050ef` / steel `#647687` / indigo `#6a00ff` / emerald `#008a00` | 6.19 / 4.68 / 6.87 / 4.53 |
| notice text `#8a5a00` on `#fff4dc` | 5.43 |
| dark: text `#c0c4cc` / muted `#9da2ab` on surface `#1e1f22` | 9.42 / 6.43 |
| dark: subtle `#8b9099` on ground `#17181b` | 5.53 |
| dark: accent `#60c3ff` on surface | 8.43 |

Every pair passes AA but the light theme's subtle grey, which the site uses
for sub-lines, notes and the footer.

**The same stylesheet dresses the VS Code webviews.** `shellThemeCss` is
inlined into the standalone shell and into four webviews — the AI panel, the
Pipeline, the Timeline and Harness Settings — where `vscodeThemeCss` maps its
tokens onto the editor's theme (ADR 0023 decision 4).

## Decision

1. **The standalone shell takes the project site's look, as the approved
   mockup draws it.** The mockup is the reference: a screen it draws is done
   when it matches it, and a difference is either fixed or recorded with its
   reason and shown to the owner.

2. **The shell's own stylesheet is rewritten to that look; no more Metro is
   added to reach it.** `shell-ui.ts` gains the site's palette as the
   shell's named tokens, in light and dark, and its components as `openspec-`
   classes: the application bar, the page head, the tab bar, the panel with its
   head and fine print, the KPI tile, the table, the segmented control, the
   controls bar and the notice. Classes the rewrite leaves unused are removed
   with it.
   - **Metro keeps the controls.** ADR 0030's scoped copy still draws buttons,
     inputs, selects, textareas and tables, as the site's own pages use them.
   - **Metro's `panel`, `card` and `timeline` families leave the copy** once no
     screen uses them, which amends 0032 decision 1. `badge` stays while the
     state words use it.

3. **The frame.** An application bar with the owl, the product name, the
   workspace path and the theme switch; a page head naming the open tab, with
   a tagline and one action where the tab has one; one row of tabs with short
   labels — Run, Processes, Diff, Summary, Editor, Templates, Timeline,
   Pipeline, Harness — underlined when current; the content; and a footer
   carrying the versions. The frame is the standalone shell's alone.

4. **The Timeline tab is redrawn as the mockup draws it**, which supersedes
   0032 decision 4.
   - **One change**: a vertical line of moments. Tasks ticked in the same
     commit are one moment ("27 tasks ticked in one commit"), opened to list
     them; the change's proposal and archive are marked moments of their own;
     beside the line, the task count, how long the change took, and each date
     with the source it was read from.
   - **Comparison**: one row per change and one column per day, with a bar
     from the day and hour a change was proposed to the day and hour it was
     archived. An active change runs to a line marking now; weekend days are
     shaded; the period is chosen with a segmented control.

5. **Colour.** The site's hues, each bound to the ink it carries, and the
   pairs measured above. The light theme's subtle grey is darkened until it
   passes AA on every ground it sits on, and the change that does it records
   the value and its ratios. Contrast stays a gate: the browser suite's axe
   runs cover WCAG AA in both themes, and a unit test computes every declared
   hue-and-ink pair.

6. **VS Code keeps the editor's colours.** The webviews use the same
   components — panel, table, tile, badge, segmented control, notice — with
   every new token mapped onto the editor's theme, and do not take the frame.
   `vscode-metro-mapping.test.ts` and `shell-ui.test.ts` already fail on a
   token that is left unmapped.

7. **A screen is checked against its mockup, not described as matching it.**
   For every screen the mockup draws, a browser spec captures that screen at
   1280 pixels wide in the light theme, and the change records the capture
   beside the mockup's artboard. Whether they match is **Human-only**: the
   owner's to judge, per screen, before its change is archived.

8. **Delivery, in this order.**
   1. **The dark theme is drawn in the mockup first**, for the same five
      screens, and approved.
   2. **The frame and the shared components**, with the tokens, in both
      themes. Every tab takes the frame.
   3. **The summary.**
   4. **Harness Settings.**
   5. **The two timelines.**
   6. **The remaining tabs** — Run, Processes, Diff, Editor, Templates and
      the Pipeline — adopt the shared components. They have no mockup; each
      change shows the owner its captures before it is archived.

## Consequences

- **Every standalone screenshot in `docs/images/standalone/` changes**, and
  the specs that capture them move with the markup.
- **Tests that pin today's classes move too**: `shell-ui.test.ts`, the view
  tests that read `panel`, `timeline` or the multi-change grid, and the
  browser specs that look controls up by their current labels or tab names.
- **The four webviews change shape where they use the shared components**,
  while keeping the editor's colours. Their live checks under a dark and a
  high-contrast editor theme are part of the change that touches them.
- **ADR 0032's cost is partly returned.** The `panel`, `card` and `timeline`
  families are 3,838 of the 7,793 bytes it added to each bundle.
- **Six changes instead of one screen at a time without a reference.** The
  order front-loads the frame, so the owner sees the new look on every tab
  after the second.

## Rejected Alternatives

### More Metro, as ADR 0032 did

Tried and shipped. Metro's families gave the screens new parts inside the old
look, and the owner could not see the difference. The site itself does not
get its look from Metro.

### Copying the site's `home.css` and `stats.css` into the bundle

They style bare elements the shell does not own, use a prefix and a token set
of their own that VS Code has no mapping for, and carry the subtle grey that
fails AA. The values are taken from them; the stylesheet is written for this
shell.

### Tailwind, or another CSS framework

A second design system beside Metro's controls, a build step for the
webviews, and no closer to the site than hand-written CSS of the same values.

### Keeping the long tab labels on two rows

The current nine labels wrap to two rows at 1280 pixels. The mockup's short
labels fit one row, which is what the owner approved.

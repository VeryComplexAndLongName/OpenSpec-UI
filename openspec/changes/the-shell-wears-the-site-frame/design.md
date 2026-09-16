## Context

ADR 0033 decides the look; the approved mockup draws it; this change builds
the part every tab shares. What exists today, read on 2026-09-16:

- **`shell-ui.ts`** holds `shellThemeCss` (a light `:root` palette, a dark
  `:root[data-openspec-theme="dark"]` palette, and the rules) and
  `vscodeThemeCss` (the same token names mapped onto the editor's variables).
  Every rule reads a token; `shell-ui.test.ts` fails on a colour literal in a
  rule, on a token one layer declares and the other does not, and on a
  hue-and-ink pair under 4.5:1.
- **The standalone frame** is `.openspec-standalone-app`, a 980-pixel grid
  holding `.openspec-shell-headline` (the owl, an `h1` "OpenSpec UI", a
  sentence, the theme switch), `Tabs`, the tab panels, and a versions line.
  The VS Code AI panel uses the same headline class.
- **Each tab panel** is a `section.openspec-shell-panel` opening with an `h2`
  naming the tab and, in most, a note saying what it is for.
- **Tab labels** come from `ALL_TABS` in `host-embed.ts`; the browser suite
  finds tabs by those names 28 times, and sections by their `h2` 6 times.

## Goals / Non-Goals

**Goals:**

- Every tab of the standalone shell is framed as the mockup frames it, in
  both themes.
- The shared components exist, tested, for the screen changes that follow.
- Nothing in VS Code changes colour source.

**Non-Goals:**

- Redrawing any screen's content. The summary, Harness Settings, the
  timelines and the remaining tabs are later changes (ADR 0033 decision 8).
- Retiring Metro's `panel`, `card` and `timeline` families. They go when the
  screens that use them are redrawn.

## Decisions

### The palette keeps its token names

The site's values go into the tokens the rules already read — `--bg`
`#f4f5f7`, `--surface` `#ffffff`, `--line` `#e1e4e8`, `--ink` `#3c4048` and
the rest — so every existing rule takes the new look without being rewritten.
Three tokens are added because the site draws with a distinction the shell did
not have:

- **`--heading`** (`#16181d`, dark `#ffffff`): titles are darker than body
  text on the site.
- **`--link`** (`#0a6ebd`, dark `#60c3ff`): the tagline and links, apart from
  `--primary`, which also fills buttons.
- **`--tab-accent`** (`#ce352c`): the underline of the current tab, in both
  themes.

`--muted` becomes `#646a74`, the site's subtle grey darkened until it passes
AA on the footer, its darkest ground: 5.45:1 on surface, 4.99:1 on the page,
4.56:1 on the footer.

The coloured-block hues become the site's: cobalt `#0050ef`, indigo `#6a00ff`
and crimson keep white ink; steel `#647687` and emerald `#008a00` now carry
white too (4.68:1 and 4.53:1), which the old lighter hues could not.

**In dark, `--primary` stays a light accent with dark ink.** The mockup's dark
buttons are cobalt with white text, but `--primary` is also a text colour —
the focus ring, an active control's label — and cobalt on the dark surface is
3.4:1. Splitting the token would touch every rule that uses it; that belongs
to the screens that draw such buttons.

### Panels take a border, not a shadow

The site gives panels a one-pixel shadow. ADR 0023 decision 2, which ADR 0033
keeps, spends a shadow only on what overlays. The panel keeps its border and
six-pixel corner; the difference is below what the eye reads at the site's
opacity of 0.06.

### The frame is two components and a table of heads

- **`AppBar`** renders the owl, the product name as text (not a heading), the
  workspace path and `ThemeToggle`.
- **`PageHead`** renders a tagline with an icon, the `h1`, and a sentence.
- **`PAGE_HEADS`** in `page-heads.ts` gives each tab id its tagline, icon,
  title and sentence. The sentence is the note each panel carried under its
  `h2`, moved; the `h2` goes, since the page head now names the tab.

The level-one heading is the open tab's title, not the product name: the
application bar already says which product this is, and a page's `h1` should
say which page.

### Short labels, full names

`TabDefinition` gains `short`. The tab shows it and keeps the full label as
`aria-label`. Every short label is the leading or a whole word of its full
name ("Summary" in "OpenSpec view summary"), so the visible label stays part
of the accessible name (WCAG 2.5.3), and the browser suite's 28 lookups by
full name keep working.

### Shared components are classes, not React components

A panel, a tile or a segmented control is markup plus a class; the screen
changes compose them. Components would fix a prop shape before the screens
that use them are written.

### The frame is checked against the mockup

`e2e/frame-screenshots.spec.ts` opens the summary tab at 1280 pixels, light
and dark, and writes `docs/images/standalone/frame-light.png` and
`frame-dark.png`. Whether the frame matches the mockup's is the owner's
judgement (ADR 0033 decision 7).

## Risks / Trade-offs

- **Every standalone picture changes**, and the specs that captured a section
  by its `h2` capture the tab panel instead.
- **The AI panel in VS Code** shares `.openspec-shell-headline` and the
  tokens. The headline rules stay for it; the tokens it reads take the editor
  theme through `vscodeThemeCss`, as before.
- **A page 200 pixels wider** changes where the Pipeline picture wraps its
  columns. Its geometry is core's, in rem, and does not depend on the page.

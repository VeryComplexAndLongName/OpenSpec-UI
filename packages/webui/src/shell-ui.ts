import { PIPELINE_CARD_REM } from "@openspec-ui/core/browser";

export function buildDefaultChangeDir(cwd: string): string {
  const trimmed = cwd.trim();
  if (!trimmed) return "";
  const separator = trimmed.includes("\\") ? "\\" : "/";
  const normalized = trimmed.replace(/[\\/]+$/, "");
  return `${normalized}${separator}openspec${separator}changes`;
}

export const shellThemeCss = `
  /* Every colour the shell draws is declared here and nowhere else —
     ADR 0023 decision 3. A literal written into a rule is the reason a
     palette change comes out patchy in the places nobody re-checks: a
     diff tint, an event row's ground, a disabled control. Each name
     says what it is FOR, so the next palette can be chosen without
     reading the rules that use it.

     Neutrals carry a slight cool bias rather than being pure grey, and
     the accent is used sparingly: an active tab, a focus ring, the
     primary button, a progress fill. Semantic colours are a separate
     set — a thing that succeeded is not "the accent". */
  :root {
    color-scheme: light;

    /* The project site's palette (ADR 0033), under the names the rules
       already read. grounds, lightest surface last: the page sits UNDER
       its panels. */
    --bg: #f4f5f7;
    --bg-accent: #eef0f3;
    --surface: #ffffff;
    --surface-2: #f7f9fc;
    --surface-3: #eef0f3;

    /* text. Titles are darker than body text on the site, so they have a
       token of their own. --muted is the site's subtle grey #767c86
       darkened until it passes AA on the darkest ground it sits on, the
       footer: 5.45:1 on --surface, 4.99:1 on --bg, 4.56:1 on the footer.
       The site's own value fails at 3.85:1 on its page. */
    --ink: #3c4048;
    --heading: #16181d;
    --muted: #646a74;

    /* A link and a tagline. Apart from --primary, which also fills a
       button: the site's #0a6ebd, one step darker, since it read 4.42:1
       on the footer. */
    --link: #0963ad;

    /* The accent fills a primary control and marks focus. Both steps
       carry white text: --primary 6.19:1, --primary-soft 7.51:1. */
    --primary: #0050ef;
    --primary-soft: #0046d1;
    --primary-bg: #e8effd;
    --primary-ink: #ffffff;

    /* The underline of the tab you are on, the site's red, in both themes. */
    --tab-accent: #ce352c;

    /* semantic, deliberately not the accent. --warn and --warn-bg are the
       site's notice. */
    --good: #16704a;
    --good-bg: #e6f2ea;
    --warn: #8a5a00;
    --warn-bg: #fff4dc;
    --bad: #a02b2b;
    --bad-bg: #fbeaea;
    --danger: var(--bad);

    /* edges. --line separates, --line-strong is for an edge that has
       to hold its own against a filled surface. */
    --line: #e1e4e8;
    --line-strong: #d5d9df;

    /* Hues for a filled block that holds a label — a badge, a tile's icon
       (the-web-ui-wears-more-metro 3.1) — each declared with the ink that
       passes WCAG AA on it, since a hue is never used with any other.
       shell-ui.test.ts computes every pair's contrast from these tokens
       directly, so a hue added later is checked too.

       Cobalt, indigo, steel and emerald are the site's tile colours and all
       carry white: 6.19:1, 6.87:1, 4.68:1, 4.53:1. Crimson carries white at
       5.0:1; the lighter hues pair with dark ink. Theme-invariant: a badge's
       colour states what it means whether the page around it is light or
       dark, so the dark palette below repeats these unchanged. */
    --cobalt: #0050ef;
    --cobalt-ink: #ffffff;
    --indigo: #6a00ff;
    --indigo-ink: #ffffff;
    --crimson: #dd0e37;
    --crimson-ink: #ffffff;
    --green: #00b300;
    --green-ink: #1b1f24;
    --orange: #ffa600;
    --orange-ink: #1b1f24;
    --teal: #1ac7c7;
    --teal-ink: #1b1f24;
    --emerald: #008a00;
    --emerald-ink: #ffffff;
    --amber: #ffc929;
    --amber-ink: #1b1f24;
    --steel: #647687;
    --steel-ink: #ffffff;

    /* A radius that softens a corner rather than announcing a card,
       and ONE shadow, spent only on what genuinely overlays — see ADR
       0023 decision 2. Border and fill do the separating. */
    --radius: 6px;
    --radius-sm: 4px;
    --shadow: 0 6px 20px rgba(16, 22, 30, 0.10);

    /* Control widths, named for the kind of value they hold rather
       than numbered per field. A control that fills its container is
       why a dropdown holding "high" was 900px wide and its arrow
       900px from the word. A select needs no width here: it is sized
       by its own options, and --w-name is only its floor. */
    --w-amount: 6.5rem;
    --w-name: 14rem;
    --w-sentence: 26rem;

    /* The day grid's two tracks: the column that names a change, which
       stays put while the days scroll, and one day. A day is wide enough
       for a marker and its gridline, not for a date — the header above
       carries the date (the-web-ui-screens-wear-metro 2.3). */
    --multi-timeline-name: 14rem;
    --multi-timeline-day: 2.25rem;
  }

  /* The standalone dark palette, chosen by the header toggle or the
     system preference (the-web-ui-wears-metro design decision 5). It
     redefines every colour token above and nothing else. It keys on the
     document element rather than the app root because body's ground is
     drawn from these tokens too. VS Code never sets this attribute: its
     colours come from the editor theme.

     The accent turns light on a dark ground, so its text turns dark:
     --primary-ink on --primary is measured the same way as in light. */
  :root[data-openspec-theme="dark"] {
    color-scheme: dark;

    /* The site's html.dark-side palette (ADR 0033). */
    --bg: #17181b;
    --bg-accent: #1b1c1f;
    --surface: #1e1f22;
    --surface-2: #232428;
    --surface-3: #2b2d30;

    --ink: #c0c4cc;
    --heading: #ffffff;
    --muted: #9da2ab;
    --link: #60c3ff;

    /* Light on a dark ground, so its text turns dark: 9.58:1. The mockup's
       dark buttons are cobalt with white text, but --primary is also a text
       colour — a focus ring, an active label — and cobalt on this surface
       is 3.4:1 (the-shell-wears-the-site-frame design.md). */
    --primary: #60c3ff;
    --primary-soft: #8fd4ff;
    --primary-bg: #1c2b36;
    --primary-ink: #0b1411;

    --tab-accent: #ce352c;

    --good: #6ede9f;
    --good-bg: #173226;
    --warn: #f0b43c;
    --warn-bg: #2e2410;
    --bad: #ff8a80;
    --bad-bg: #3a1c1c;

    --line: #2b2d30;
    --line-strong: #34363b;

    /* Theme-invariant (3.1's comment above): same hues, same ink, in
       either theme. */
    --cobalt: #0050ef;
    --cobalt-ink: #ffffff;
    --indigo: #6a00ff;
    --indigo-ink: #ffffff;
    --crimson: #dd0e37;
    --crimson-ink: #ffffff;
    --green: #00b300;
    --green-ink: #1b1f24;
    --orange: #ffa600;
    --orange-ink: #1b1f24;
    --teal: #1ac7c7;
    --teal-ink: #1b1f24;
    --emerald: #008a00;
    --emerald-ink: #ffffff;
    --amber: #ffc929;
    --amber-ink: #1b1f24;
    --steel: #647687;
    --steel-ink: #ffffff;

    --shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  }

  body {
    margin: 0;
    font-family: system-ui, "Segoe UI", "Helvetica Neue", sans-serif;
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink);
    background: var(--bg);
  }

  /* Never set anywhere before this, which is why every control given a
     width of 100% stood exactly its own padding and border past its
     box. It showed up as the Change Editor's textarea sticking 18px
     out of its field — invisible, because it stuck out into an empty
     gutter, and a whole class of the same bug waiting for a narrower
     container. Scoped to the app rather than set on every element in
     the document: this stylesheet is injected into a host document
     that is not always ours to reset. */
  .openspec-standalone-app,
  .openspec-extension-app,
  .openspec-standalone-app *,
  .openspec-extension-app * {
    box-sizing: border-box;
  }

  .openspec-extension-app {
    max-width: 980px;
    margin: 22px auto;
    padding: 18px;
    display: grid;
    gap: 14px;
  }

  /* The standalone shell is a page the width of the window: the bar across
     the top and the footer span it, and the content sits in a 1180-pixel
     column between them (the-shell-wears-the-site-frame, ADR 0033). */
  .openspec-standalone-app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .openspec-page {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
    padding: 32px 20px 0;
    display: grid;
    gap: 20px;
    align-content: start;
  }

  .openspec-app-bar {
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  .openspec-app-bar-inner {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 1180px;
    height: 56px;
    margin: 0 auto;
    padding: 0 20px;
  }

  .openspec-app-bar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-right: auto;
    font-size: 17px;
    font-weight: 600;
    color: var(--heading);
  }

  .openspec-app-bar-brand .openspec-shell-logo {
    width: 28px;
    height: 28px;
  }

  .openspec-app-bar-path {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
    color: var(--muted);
  }

  .openspec-app-bar .openspec-theme-toggle {
    margin-left: 0;
  }

  .openspec-page-head-tagline {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--link);
  }

  .openspec-page-head h1 {
    margin: 6px 0 4px;
    font-size: 32px;
    font-weight: 300;
    line-height: 1.2;
    color: var(--heading);
  }

  .openspec-page-head-sentence {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  /* The page grows to push the footer to the bottom of a short screen. */
  .openspec-standalone-app > .openspec-page {
    flex: 1 0 auto;
  }

  .openspec-app-footer {
    margin-top: 28px;
    background: var(--bg-accent);
    border-top: 1px solid var(--line);
  }

  .openspec-app-footer-inner {
    display: flex;
    align-items: center;
    max-width: 1180px;
    min-height: 56px;
    margin: 0 auto;
    padding: 0 20px;
    font-size: 13px;
    color: var(--muted);
  }

  /* A heading is not a card. It gets a rule under it and nothing
     else — ADR 0023 decision 2: where every block carries the same
     border, radius and shadow, none of them is emphasised. */
  .openspec-shell-headline {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 0 14px;
    border-bottom: 1px solid var(--line);
  }

  /* The owl, in its own colours in every theme: the dark disc reads on
     light and dark alike. See the-owl-marks-the-app. */
  .openspec-shell-logo {
    flex: none;
    width: 40px;
    height: 40px;
  }

  .openspec-shell-headline h1 {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .openspec-shell-headline p {
    margin: 0;
    color: var(--muted);
  }

  /* The theme toggle sits at the far end of the headline, apart from
     the name it would otherwise read as part of. */
  .openspec-theme-toggle {
    margin-left: auto;
    flex: none;
  }

  /* The theme control is a switch (a-screen-says-what-it-is-doing 4.2): the
     knob slides to the right when the theme is dark, and carries a sun or a
     moon, so the state is seen without reading the unchanged label. */
  .openspec-theme-switch {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  .openspec-theme-switch:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .openspec-theme-switch-track {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    border: 1px solid var(--line-strong);
    border-radius: 11px;
    background: var(--surface-2);
    box-sizing: border-box;
    transition: background-color 0.2s ease;
  }

  .openspec-theme-switch[aria-checked="true"] .openspec-theme-switch-track {
    background: var(--primary);
    border-color: var(--primary);
  }

  .openspec-theme-switch-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--surface);
    color: var(--muted);
    transition: transform 0.2s ease;
  }

  .openspec-theme-switch[aria-checked="true"] .openspec-theme-switch-knob {
    transform: translateX(18px);
    color: var(--primary);
  }

  @media (prefers-reduced-motion: reduce) {
    .openspec-theme-switch-track,
    .openspec-theme-switch-knob {
      transition: none;
    }
  }

  /* One row of tabs over a rule, the one you are on underlined in the
     site's red (the-shell-wears-the-site-frame, ADR 0033). It still wraps
     on a narrow window rather than scrolling sideways. */
  .openspec-page-tabs {
    display: flex;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--line);
  }

  .openspec-page-tabs button {
    position: relative;
    margin-bottom: -1px;
    padding: 8px 16px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .openspec-page-tabs button:hover {
    color: var(--heading);
  }

  .openspec-page-tabs button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }

  .openspec-page-tabs button.is-active {
    border-bottom-color: var(--tab-accent);
    color: var(--heading);
  }

  .openspec-page-tab-panel {
    display: grid;
    gap: 14px;
  }

  .openspec-page-tab-panel[hidden] {
    display: none;
  }

  /* A tab that is reading (a-screen-says-what-it-is-doing): a moving bar, a
     spinner, the sentence and, past three seconds, the elapsed seconds. The
     third screen of the redesign mockup the owner approved. */
  .openspec-panel-status {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px 10px;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }

  .openspec-panel-status-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    overflow: hidden;
    background: var(--line);
  }

  .openspec-panel-status-bar > span {
    position: absolute;
    top: 0;
    left: -35%;
    width: 35%;
    height: 100%;
    background: var(--primary);
    animation: openspec-reading-slide 1.4s ease-in-out infinite;
  }

  .openspec-panel-status-spinner,
  .openspec-tab-spinner {
    display: inline-block;
    flex: none;
    box-sizing: border-box;
    border: 2px solid var(--line);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: openspec-reading-spin 0.9s linear infinite;
  }

  .openspec-panel-status-spinner {
    width: 16px;
    height: 16px;
  }

  /* Laid over the tab's corner rather than beside its label: taking room
     there moved every tab after it each time a reading started or ended. */
  .openspec-tab-spinner {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 8px;
    height: 8px;
  }

  .openspec-panel-status-text {
    margin: 0;
    font-weight: 600;
    color: var(--ink);
  }

  .openspec-panel-status-elapsed {
    margin-left: auto;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  /* Holds a tab's controls while it reads, and otherwise lays nothing out. */
  .openspec-busy-fieldset {
    display: contents;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  @keyframes openspec-reading-slide {
    from { left: -35%; }
    to { left: 100%; }
  }

  @keyframes openspec-reading-spin {
    to { transform: rotate(360deg); }
  }

  /* Still for a person who asks for less motion: the sentence alone says the
     tab is reading. */
  @media (prefers-reduced-motion: reduce) {
    .openspec-panel-status-bar > span,
    .openspec-panel-status-spinner,
    .openspec-tab-spinner {
      animation: none;
    }
  }

  /* Border and fill separate a panel. No shadow: it does not overlay
     anything. */
  .openspec-shell-panel {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 16px 18px;
  }

  .openspec-shell-panel h2 {
    margin: 0 0 10px;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.005em;
  }

  .openspec-shell-panel h3 {
    margin: 22px 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  /* The panel's own first child sits at the top of it. Deliberately
     not every section's first child: that reset removed the space
     above "What this configuration cannot do", leaving the heading
     jammed against the paragraph before it. The space belongs between
     the sections instead. */
  .openspec-shell-panel > :first-child {
    margin-top: 0;
  }

  .openspec-shell-panel section {
    margin-top: 26px;
  }

  .openspec-shell-panel > section:first-of-type {
    margin-top: 0;
  }

  .openspec-shell-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    /* Between two fields, and larger than the gap inside one. */
    gap: 18px;
    margin-bottom: 10px;
  }

  /* Fault 1, and the whole of its fix is these two gaps. A name 6px
     from its own control and 12px from the one above belongs, to the
     eye, to the one above. Inside a field: 3px. Between fields: 18px.

     The name is also told from prose by WEIGHT, never by colour alone
     — that is the distinction a reader who cannot see it loses, and
     the one that fails a contrast check first. */
  .openspec-shell-field {
    display: grid;
    /* minmax(0, 1fr), not the implicit default: a grid track's automatic
       minimum is its item's min-content width, so a select whose widest
       option is a sentence pushes the field past its own panel and
       a max-width of 100% never gets to bite. Found on the Change Editor
       by sweeping every tab; the settings pane needed the same thing
       for its second column. */
    grid-template-columns: minmax(0, 1fr);
    gap: 3px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--ink);
  }

  .openspec-page-tab-panel .openspec-shell-field + .openspec-shell-field {
    margin-top: 18px;
  }

  /* Metro draws the controls: border, radius, padding, height and their
     states (ADR 0030). The shell sets only what a dense form needs
     differently. A control reads in the text size around it, rather than
     Metro's 16px, so a placeholder and a value are the same size. */
  .openspec-metro {
    --input-font-size: 1em;
    /* A table's text follows the page too: Metro's 16px body cells stood
       a size above the 13px prose around the Processes and chart tables. */
    --table-body-font-size: 1em;
    --table-head-font-size: 1em;
    --table-caption-font-size: 1em;

    /* A disabled control still says what it is. Metro's dark palette
       draws one at 25% opacity, or as near-black text on a near-black
       ground, and on screen it all but vanished beside the controls that
       work. Disabled text needs no contrast ratio, but it should still be
       legible, so these come from the shell's tokens in both themes. The
       VS Code layer sets them again, from the editor theme. */
    --button-disabled-opacity: 0.55;
    --input-color-disabled: var(--muted);
    --input-background-disabled: var(--surface-2);
  }

  .openspec-shell-field input,
  .openspec-shell-field textarea,
  .openspec-shell-field select,
  .openspec-ai-panel-controls select,
  .openspec-ai-panel-controls button {
    font: inherit;
    font-weight: 400;
    letter-spacing: normal;
  }

  /* Fault 3. Every control filled its container, which is why a
     dropdown holding "high" was the width of the page and its arrow
     was at the far right of it.

     A select is sized by its own widest option, which is what a
     browser already does well on its own — with a floor so a column
     of short ones stays tidy and a ceiling so that nothing overflows.
     A fixed width here was the first attempt and it clipped the
     autonomy level to "assisted — one stage at a time, a cl"; a width
     guessed per control is exactly how that happens, and clipped text
     is a bug, not a tight fit. */
  .openspec-shell-field select,
  .openspec-ai-panel-controls select {
    width: auto;
    /* The floor is a preference, not a demand: min() lets it give way
       where the space is smaller than it, which is what stops a column
       of tidy 14rem selects from forcing a page to scroll sideways. */
    min-width: min(var(--w-name), 100%);
    max-width: 100%;
    justify-self: start;
  }

  /* An input has no content to be measured, so it takes a width from
     the kind of value it holds. */
  .openspec-shell-field input {
    width: min(var(--w-sentence), 100%);
    justify-self: start;
  }

  .openspec-shell-field input[type="number"] {
    width: var(--w-amount);
  }

  /* Metro's field rule lists text, search, date and the like, but not
     number, which then kept the browser's own short box beside 36px
     selects. It is drawn from the same Metro variables here. */
  .openspec-metro input[type="number"] {
    height: var(--input-height);
    padding: 0 8px;
    border: 1px solid var(--input-border-color);
    border-radius: var(--input-border-radius);
    color: var(--input-color);
    background: var(--input-background);
  }

  .openspec-shell-field textarea {
    width: 100%;
  }

  .openspec-shell-field input:focus-visible,
  .openspec-shell-field textarea:focus-visible,
  .openspec-shell-field select:focus-visible,
  .openspec-ai-panel-controls select:focus-visible,
  .openspec-ai-panel-controls button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
    border-color: var(--primary);
  }

  .openspec-shell-note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  /* An icon before a label (the-web-ui-screens-wear-metro 4.x) sits a
     little apart from the word, so the glyph does not touch its first
     letter. */
  [class^="openspec-icon-"],
  [class*=" openspec-icon-"] {
    display: inline-block;
    line-height: 1;
  }

  .button > [class^="openspec-icon-"] {
    margin-inline-end: 0.45em;
  }

  /* An action inside a sentence: a real button, styled as the link it
     reads as, so it is focusable and named without looking like a
     second save control. */
  .openspec-inline-action {
    border: 0;
    padding: 0;
    background: none;
    color: var(--primary);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  /* The shared components of ADR 0033 (the-shell-wears-the-site-frame 3.1),
     drawn from tokens only, for the screens redrawn after the frame. */
  .openspec-panel {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .openspec-panel-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
  }

  .openspec-panel-head h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--heading);
  }

  .openspec-panel-body {
    padding: 16px;
  }

  .openspec-panel-fine {
    margin: 0;
    padding: 10px 16px 12px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    line-height: 1.55;
    color: var(--muted);
  }

  .openspec-table {
    width: 100%;
    border-collapse: collapse;
    color: var(--ink);
  }

  .openspec-table th {
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    color: var(--muted);
  }

  .openspec-table td {
    padding: 8px 16px;
    border-top: 1px solid var(--line);
  }

  .openspec-table tbody tr:hover td {
    background: var(--surface-2);
  }

  .openspec-segmented {
    display: inline-flex;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    font-size: 13px;
  }

  .openspec-segmented > button {
    padding: 6px 12px;
    border: 0;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  .openspec-segmented > button + button {
    border-left: 1px solid var(--line-strong);
  }

  .openspec-segmented > button:hover {
    background: var(--surface-3);
    color: var(--heading);
  }

  .openspec-segmented > button[aria-pressed="true"] {
    background: var(--primary);
    color: var(--primary-ink);
  }

  .openspec-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .openspec-notice {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid var(--warn);
    border-radius: var(--radius);
    background: var(--warn-bg);
    color: var(--warn);
    font-size: 13px;
    line-height: 1.55;
  }

  .openspec-ai-panel {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px;
    background: var(--surface);
  }

  .openspec-ai-panel-banner {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    margin-bottom: 10px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--line) 60%);
    background: var(--bad-bg);
    color: var(--ink);
    font-size: 13px;
  }

  .openspec-ai-panel-banner a {
    color: var(--danger);
    font-weight: 600;
    text-decoration: none;
  }

  .openspec-ai-panel-banner a:hover {
    text-decoration: underline;
  }

  /* Fault 2. A row of controls acts on the block above it, so it is
     separated from that block by more than the fields inside it are
     separated from each other. Flush against the last field, the
     button reads as part of that field rather than as the end of the
     group. */
  .openspec-ai-panel-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 22px;
    margin-bottom: 10px;
  }

  .openspec-run-status {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--muted);
  }

  .openspec-run-insights {
    margin: 0 0 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--line) 75%);
    background: var(--primary-bg);
    display: grid;
    gap: 8px;
  }

  .openspec-run-insights h3 {
    margin: 0;
    font-size: 14px;
  }

  .openspec-run-insights-meta {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .openspec-run-insights-steps,
  .openspec-run-insights-warnings {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 4px;
    font-size: 12px;
  }

  .openspec-run-insights-highlight {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-size: 12px;
  }

  /* An action's colour is the shell's, not Metro's (the-web-ui-wears-metro
     design decision 4): Metro's colour classes are literal and fail AA.
     Metro draws the button itself, its height, padding and disabled
     state. The primary action of a form is the accent; an action that
     stops or discards something is the danger colour. Every other button
     is Metro's neutral one. */
  .openspec-metro .button.primary,
  .openspec-metro .button.alert {
    color: var(--primary-ink);
    background: var(--primary);
    border-color: transparent;
    font-weight: 600;
  }

  .openspec-metro .button.primary:hover:not(:disabled) {
    background: var(--primary-soft);
  }

  .openspec-metro .button.alert {
    background: var(--danger);
  }

  .openspec-metro .button.alert:hover:not(:disabled) {
    background: color-mix(in srgb, var(--danger) 85%, var(--ink));
  }

  /* The focus ring sits on the fill here, so it has to be drawn against
     the button rather than in it — a quieter palette is exactly where a
     ring disappears into its own control. */
  .openspec-metro .button.primary:focus-visible,
  .openspec-metro .button.alert:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    border-color: transparent;
  }

  .openspec-ai-panel-events {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow: auto;
    display: grid;
    gap: 6px;
  }

  .openspec-event {
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 10px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .openspec-event pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .openspec-status-card {
    display: grid;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface);
  }

  .openspec-status-card-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: baseline;
  }

  .openspec-status-card-meta,
  .openspec-status-card-instruction {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }

  .openspec-status-meter {
    height: 7px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface-3);
  }

  .openspec-status-meter-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary) 0%, var(--primary-soft) 100%);
  }

  .openspec-status-artifacts {
    margin: 0;
    padding-left: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }

  .openspec-status-artifacts li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
  }

  .openspec-status-artifact-id {
    color: var(--ink);
  }

  .openspec-status-pill {
    font-size: 10px;
    letter-spacing: 0.2px;
    padding: 2px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    font-weight: 700;
    background: var(--surface-3);
    color: var(--muted);
  }

  .openspec-status-pill.is-done,
  .openspec-status-pill.is-complete {
    background: var(--good-bg);
    color: var(--good);
  }

  .openspec-status-pill.is-blocked,
  .openspec-status-pill.is-failed {
    background: var(--bad-bg);
    color: var(--bad);
  }

  .openspec-data-card {
    display: grid;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface);
  }

  .openspec-data-card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .openspec-data-card-head span,
  .openspec-data-card-note,
  .openspec-data-card-secondary {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }

  .openspec-data-card-list {
    margin: 0;
    padding-left: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }

  .openspec-data-card-list li {
    display: grid;
    gap: 2px;
  }

  .openspec-data-card-primary {
    color: var(--ink);
  }

  .openspec-event-checklist,
  .openspec-event-bullets,
  .openspec-event-steps {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 6px;
  }

  .openspec-event-step {
    display: grid;
    gap: 4px;
  }

  .openspec-event-step-title {
    font-weight: 700;
    color: var(--ink);
  }

  .openspec-event-step-details {
    margin: 0;
    padding-left: 16px;
    color: var(--muted);
    display: grid;
    gap: 2px;
  }

  .openspec-event-checklist li {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .openspec-checkmark {
    border-radius: 999px;
    padding: 1px 7px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: 700;
  }

  .openspec-checkmark.is-checked {
    background: var(--good-bg);
    color: var(--good);
  }

  .openspec-checkmark.is-open {
    background: var(--warn-bg);
    color: var(--warn);
  }

  .openspec-event-kv {
    margin: 0;
    display: grid;
    gap: 6px;
  }

  .openspec-event-kv-row {
    display: grid;
    grid-template-columns: minmax(90px, 180px) 1fr;
    gap: 10px;
  }

  .openspec-event-kv dt {
    color: var(--muted);
  }

  .openspec-event-kv dd {
    margin: 0;
    color: var(--ink);
  }

  .openspec-event--failed,
  .openspec-event--stderr {
    border-color: color-mix(in srgb, var(--danger) 35%, var(--line) 65%);
    background: var(--bad-bg);
  }

  .openspec-event--completed {
    border-color: color-mix(in srgb, var(--primary) 35%, var(--line) 65%);
    background: var(--good-bg);
  }

  .openspec-usage-summary {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 12px;
    margin: 10px 0;
    background: var(--surface-2);
    font-size: 12px;
  }

  .openspec-usage-summary-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }

  .openspec-usage-budget,
  .openspec-usage-note {
    margin: 6px 0 0;
    color: var(--muted);
  }

  .openspec-usage-stages {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }

  .openspec-usage-stage {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) auto;
    gap: 4px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 6px 8px;
    background: var(--surface);
  }

  .openspec-usage-stage-name {
    font-weight: 600;
  }

  .openspec-usage-stage-figure {
    text-align: right;
    color: var(--ink);
  }

  .openspec-usage-stage-live {
    grid-column: 1 / -1;
    color: var(--muted);
  }

  .openspec-diff {
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
  }

  .openspec-diff-header {
    background: var(--surface-2);
    padding: 8px 10px;
    font-size: 12px;
    color: var(--muted);
    border-bottom: 1px solid var(--line);
  }

  .openspec-diff-body {
    margin: 0;
    padding: 10px;
    max-height: 70vh;
    overflow: auto;
    background: var(--surface);
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
  }

  .openspec-diff-line { white-space: pre; }
  .openspec-diff-line--added { color: var(--good); }
  .openspec-diff-line--removed { color: var(--bad); }
  /* A file's header lines and a hunk's range: what the lines below belong
     to, not a change of their own (a-screen-says-what-it-is-doing 2.2). */
  .openspec-diff-line--meta { color: var(--muted); font-weight: 600; }
  .openspec-diff-line--hunk { color: var(--muted); }

  .openspec-overview {
    display: grid;
    gap: 12px;
  }

  .openspec-overview-meta {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .openspec-overview-block h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }

  /* The summary as ADR 0033's mockup lays it out
     (the-summary-looks-like-the-mockup): panels on the page, not inside one. */
  .openspec-summary,
  .openspec-overview {
    display: grid;
    gap: 20px;
  }

  /* The tiles are one row of the summary's grid, spaced by its gap alone. */
  .openspec-summary .openspec-overview-tiles {
    margin: 0;
  }

  /* The schedule's announcement region stays in the page for a screen
     reader, and takes no room while it has nothing to say: an empty grid
     item still costs the page a gap, which pushed the tabs away from the
     head. */
  .openspec-page > [data-testid="schedule-status"]:empty {
    margin-top: -20px;
  }

  .openspec-summary-pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    align-items: start;
  }

  .openspec-page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }

  .openspec-page-head-action {
    flex: none;
  }

  /* A secondary action as the site draws one: white, a grey border, the
     heading's ink. Metro's own grey fill is what made every button on the
     page look like the next. */
  .openspec-metro .button.openspec-button-quiet {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 16px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--heading);
  }

  .openspec-metro .button.openspec-button-quiet:hover:not(:disabled) {
    background: var(--surface-3);
  }

  .openspec-metro .button.openspec-button-small {
    height: 28px;
    padding: 0 12px;
    font-size: 13px;
  }

  .openspec-panel-head-note {
    font-size: 12px;
    color: var(--muted);
  }

  /* A panel with nothing to list says so, instead of a header over no rows. */
  .openspec-panel-empty {
    margin: 0;
    color: var(--muted);
  }

  /* Harness Settings as ADR 0033's mockup draws it
     (the-harness-settings-look-like-the-mockup): the named configuration,
     the warning callout, and one panel of stage rows, a band of the
     chain-wide settings, and a foot. A change's own settings share it. */
  .openspec-harness-settings {
    display: grid;
    gap: 20px;
  }

  /* The grid's gap is the only space between the sections. A shell panel's
     own rule for a section's top margin, meant for sections that are
     siblings in its flow, doubled it in the Change Editor. */
  .openspec-harness-settings > section {
    margin-top: 0;
  }

  /* Read by a screen reader, not drawn. */
  .openspec-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* A choice drawn as segments of one control. The radio inside each
     segment covers it, transparent, so the browser keeps its keys, focus
     and checked state. Each segment draws its own border, overlapping its
     neighbour's by a pixel, so a choice too wide for its column wraps into
     rows that still read as one control. */
  .openspec-segmented {
    display: inline-flex;
    flex-wrap: wrap;
    align-self: flex-start;
    padding: 1px 0 0 1px;
    font-size: 13px;
  }

  .openspec-segment {
    position: relative;
    display: inline-flex;
    align-items: center;
    margin: -1px 0 0 -1px;
    padding: 6px 12px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
    white-space: nowrap;
  }

  .openspec-segment:first-child {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }

  .openspec-segment:last-child {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .openspec-metro .openspec-segment input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .openspec-segment:hover {
    background: var(--surface-2);
  }

  .openspec-segment:has(input:checked) {
    z-index: 1;
    border-color: var(--cobalt);
    background: var(--cobalt);
    color: var(--cobalt-ink);
  }

  .openspec-segment:has(input:focus-visible) {
    outline: 2px solid var(--primary);
    outline-offset: -3px;
  }

  .openspec-named-configuration {
    padding: 14px 16px;
  }

  .openspec-named-configuration-choose {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
  }

  .openspec-named-configuration-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--heading);
  }

  .openspec-named-configuration-description p {
    margin: 12px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
  }

  .openspec-named-configuration-description p + p {
    margin-top: 4px;
  }

  .openspec-named-configuration-description strong {
    color: var(--heading);
  }

  .openspec-named-configuration-description .openspec-named-configuration-basis {
    margin-top: 6px;
    font-size: 12px;
    color: var(--muted);
  }

  .openspec-named-configuration-status {
    margin: 10px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
  }

  /* What the configuration cannot do, as the mockup's warning callout. */
  .openspec-callout {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid var(--amber);
    border-radius: var(--radius);
    background: var(--warn-bg);
    color: var(--warn);
  }

  .openspec-callout-icon {
    margin-top: 1px;
    font-size: 18px;
  }

  .openspec-callout-body h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--warn);
  }

  .openspec-callout-body ul {
    margin: 2px 0 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
    line-height: 1.55;
  }

  .openspec-callout-fine {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
  }

  /* A panel head that leads with an icon in a cell of its own. */
  .openspec-panel-head--icon {
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 0;
    padding: 0;
  }

  .openspec-panel-head-icon {
    display: flex;
    flex: none;
    align-self: stretch;
    align-items: center;
    justify-content: center;
    width: 46px;
    border-right: 1px solid var(--line);
    color: var(--link);
    font-size: 18px;
  }

  .openspec-panel-head--icon h2 {
    padding: 12px 16px;
  }

  .openspec-panel-head--icon .openspec-panel-head-note {
    margin-left: auto;
    padding: 12px 16px;
    text-align: right;
  }

  /* One row per stage: number and name, agent, model, effort, max cost. */
  .openspec-stage-grid {
    display: grid;
    grid-template-columns: 170px minmax(0, 1.3fr) minmax(0, 1fr) 150px 130px;
    gap: 0 12px;
    align-items: center;
    padding: 9px 16px;
  }

  .openspec-stage-head {
    padding: 8px 16px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }

  .openspec-harness-stage-row {
    border-top: 1px solid var(--line);
  }

  .openspec-stage-name {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    color: var(--heading);
  }

  .openspec-stage-number {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--surface-3);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
  }

  .openspec-stage-row--mechanical {
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .openspec-stage-row--mechanical .openspec-stage-name {
    color: var(--muted);
  }

  .openspec-stage-mechanical {
    grid-column: 2 / -1;
    font-size: 13px;
    color: var(--muted);
  }

  .openspec-stage-cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .openspec-metro .openspec-stage-cell select,
  .openspec-metro .openspec-stage-cell input,
  .openspec-metro .openspec-harness-band input {
    width: 100%;
    min-width: 0;
    height: 30px;
    box-sizing: border-box;
    font-size: 13px;
  }

  .openspec-stage-none {
    font-size: 13px;
    color: var(--muted);
  }

  /* A number with its unit: a dollar sign inside the field, credits after it. */
  .openspec-amount {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .openspec-amount-unit {
    font-size: 12px;
    color: var(--muted);
  }

  .openspec-amount--dollars .openspec-amount-unit {
    position: absolute;
    left: 10px;
    z-index: 1;
    font-size: 13px;
    pointer-events: none;
  }

  .openspec-metro .openspec-amount--dollars input {
    padding-left: 22px;
  }

  .openspec-harness-band .openspec-amount {
    width: 130px;
  }

  /* What the stage rows do not show about custom agents, once per CLI. */
  .openspec-harness-notes {
    padding: 10px 16px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }

  .openspec-harness-notes p {
    margin: 0;
  }

  .openspec-harness-notes p + p {
    margin-top: 4px;
  }

  /* The chain-wide settings, side by side under the stages. */
  /* The autonomy level has the most segments, and the run budget one field. */
  .openspec-harness-band {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.8fr);
    gap: 24px;
    padding: 18px 16px;
    border-top: 1px solid var(--line);
    background: var(--surface-2);
  }

  .openspec-harness-band-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .openspec-harness-band-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--heading);
  }

  .openspec-harness-band-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }

  .openspec-metro .badge.openspec-harness-gate {
    position: static;
    display: inline-block;
    padding: 5px 9px;
    border: 0;
    border-radius: 3px;
    background: var(--steel);
    color: var(--steel-ink);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .openspec-harness-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 14px 16px;
    border-top: 1px solid var(--line);
  }

  .openspec-harness-foot-unsaved {
    font-size: 13px;
    color: var(--warn);
  }

  .openspec-harness-foot-message {
    font-size: 13px;
    color: var(--ink);
  }

  .openspec-harness-foot-file {
    margin-left: auto;
    font-size: 13px;
    color: var(--muted);
  }

  .openspec-harness-foot-file code {
    font-size: 12px;
  }

  .openspec-harness-file pre {
    margin: 0;
    padding: 12px 16px;
    overflow: auto;
    background: var(--surface-2);
    color: var(--ink);
    font-size: 12px;
    line-height: 1.5;
  }

  .openspec-panel-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .openspec-link-button {
    padding: 0;
    border: 0;
    background: none;
    color: var(--link);
    font: inherit;
    cursor: pointer;
  }

  .openspec-link-button:hover {
    text-decoration: underline;
  }

  .openspec-cell-number {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .openspec-table th.openspec-cell-number {
    text-align: right;
  }

  .openspec-cell-muted {
    color: var(--muted);
  }

  /* A search box in a panel's head, with its magnifier. */
  .openspec-search {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: min(280px, 100%);
    color: var(--muted);
  }

  /* Above the input, which is drawn after it and would paint over it. */
  .openspec-search svg {
    position: absolute;
    left: 10px;
    z-index: 1;
    pointer-events: none;
  }

  .openspec-metro .openspec-search input[type="search"] {
    width: 100%;
    height: 30px;
    padding: 0 10px 0 30px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--heading);
    font-size: 13px;
  }

  .openspec-archive-list-search {
    padding: 10px 16px;
    border-bottom: 1px solid var(--line);
  }

  /* Rows as the mockup's tables draw them: a column header, then one row per
     item, each a button with no browser fill. Changes/Archive lists sit in a
     bounded, scrollable container (virtualize-change-lists) whose row height
     matches useVirtualList's estimate: 44px, or 60px with a standing's
     lines under the name. */
  .openspec-change-columns {
    display: grid;
    /* The state column holds a standing's word too, and "Further along in
       <branch>" is far longer than the mockup's "In progress". */
    grid-template-columns: minmax(0, 1fr) 220px 220px 90px;
    align-items: center;
  }

  .openspec-archive-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 100px 100px;
    align-items: center;
  }

  .openspec-rows-head {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }

  .openspec-rows-head > span {
    padding: 8px 16px;
  }

  .openspec-row-end {
    text-align: right;
  }

  .openspec-rows {
    margin: 0;
    padding: 0;
  }

  .openspec-rows li {
    list-style: none;
    height: 44px;
    box-sizing: border-box;
  }

  .openspec-rows li.openspec-row--tall {
    height: 60px;
  }

  .openspec-rows .openspec-row {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    border-top: 1px solid var(--line);
    border-radius: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .openspec-rows .openspec-row:hover {
    background: var(--surface-2);
  }

  .openspec-rows .openspec-row:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }

  .openspec-row > span {
    padding: 0 16px;
    min-width: 0;
  }

  .openspec-row-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .openspec-row-name > span:first-child {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 600;
    color: var(--heading);
  }

  .openspec-row-day {
    color: var(--muted);
    white-space: nowrap;
  }

  /* The full archive is the "Recently archived" table opened out, and writes
     its names as that table does. */
  .openspec-archive-list .openspec-row-name > span:first-child {
    font-weight: 400;
    color: var(--ink);
  }

  .openspec-row-tasks {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .openspec-progress {
    position: relative;
    display: block;
    flex: none;
    width: 120px;
    height: 6px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--surface-3);
  }

  .openspec-progress > span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 3px;
    background: var(--primary);
  }

  .openspec-change-progress {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* A state as the site draws a badge: a small solid block, the word in
     capitals, in the hue that says it. The word is always written; the colour
     only agrees with it. */
  .openspec-row-state .badge,
  .openspec-change-state,
  .openspec-change-standing {
    position: static;
    display: inline-block;
    padding: 3px 8px;
    border: 0;
    border-radius: 3px;
    background: var(--steel);
    color: var(--steel-ink);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* A word longer than its column is cut inside the badge, and read whole
     from its title, rather than drawn over the next column. */
  .openspec-row-state .badge {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
    box-sizing: border-box;
  }

  /* As specific as the row's badge rule above, so the hue is not lost to its
     steel. */
  .openspec-change-state.openspec-change-state--in-progress { background: var(--cobalt); color: var(--cobalt-ink); }
  .openspec-change-state.openspec-change-state--implemented { background: var(--emerald); color: var(--emerald-ink); }

  .openspec-change-standing-lines {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
  }

  .openspec-change-standing-block {
    border: 0 solid var(--line);
    border-left-width: 4px;
    padding-left: 10px;
    margin: 8px 0;
  }

  /* The run dialog's standing block keeps a border and a light tint. */
  .openspec-change-standing--settled { border-color: var(--good); background: var(--good-bg); }
  .openspec-change-standing--ahead { border-color: var(--warn); background: var(--warn-bg); }
  .openspec-change-standing--now { border-color: var(--primary); background: var(--primary-bg); }
  .openspec-change-standing--failed { border-color: var(--bad); background: var(--bad-bg); }
  .openspec-change-standing--deleted { border-color: var(--line-strong); background: var(--surface-3); }

  /* The summary's badge is solid, in the hue that agrees with its word. */
  .openspec-change-standing.openspec-change-standing--settled { background: var(--emerald); color: var(--emerald-ink); }
  .openspec-change-standing.openspec-change-standing--ahead { background: var(--amber); color: var(--amber-ink); }
  .openspec-change-standing.openspec-change-standing--now { background: var(--cobalt); color: var(--cobalt-ink); }
  .openspec-change-standing.openspec-change-standing--failed { background: var(--crimson); color: var(--crimson-ink); }
  .openspec-change-standing.openspec-change-standing--deleted { background: var(--steel); color: var(--steel-ink); }

  .openspec-overview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
  }

  .openspec-overview-table th,
  .openspec-overview-table td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
  }

  .openspec-overview-table thead th {
    background: var(--surface-2);
    color: var(--muted);
    font-weight: 600;
  }

  .openspec-overview-table tbody tr:last-child td {
    border-bottom: none;
  }

  .openspec-overview-table-subheader td {
    background: var(--surface-2);
    color: var(--muted);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .openspec-process-details {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }

  .openspec-process-details h3,
  .openspec-process-details h4 {
    margin: 8px 0;
  }

  .openspec-overview-error {
    margin: 0;
    color: var(--danger);
    font-size: 12px;
  }

  .openspec-editor-tabs {
    display: flex;
    gap: 8px;
    margin: 10px 0;
    flex-wrap: wrap;
  }

  .openspec-editor-tabs button {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--ink);
    padding: 6px 10px;
    cursor: pointer;
  }

  .openspec-editor-tabs button.is-active {
    background: var(--primary);
    color: var(--primary-ink);
    border-color: transparent;
  }

  .openspec-editor-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    gap: 12px;
    margin-bottom: 10px;
  }

  .openspec-editor-textarea {
    min-height: 320px;
    resize: vertical;
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
  }

  /* Running prose stays near 70 characters. This is the screen that
     renders a proposal, and it ran the full width of the page.
     Deliberately NOT applied to the short hints beside controls: a
     caption is not running prose, and capping it leaves a narrow
     column in a wide panel. */
  .openspec-md-preview p,
  .openspec-md-preview li {
    max-width: 72ch;
  }

  .openspec-md-preview {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 10px;
    min-height: 320px;
    overflow: auto;
    font-size: 13px;
  }

  .openspec-md-preview p,
  .openspec-md-preview ul,
  .openspec-md-preview ol,
  .openspec-md-preview pre,
  .openspec-md-preview blockquote,
  .openspec-md-preview table,
  .openspec-md-preview h2,
  .openspec-md-preview h3,
  .openspec-md-preview h4 {
    margin: 0 0 8px;
  }

  .openspec-md-preview ul,
  .openspec-md-preview ol {
    padding-left: 20px;
  }

  .openspec-md-preview pre {
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px;
    overflow: auto;
  }

  .openspec-md-preview code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
  }

  .openspec-md-preview blockquote {
    border-left: 3px solid var(--line);
    padding-left: 10px;
    color: var(--muted);
  }

  .openspec-md-preview table {
    width: 100%;
    border-collapse: collapse;
  }

  .openspec-md-preview th,
  .openspec-md-preview td {
    border: 1px solid var(--line);
    padding: 6px 8px;
    text-align: left;
  }

  .openspec-md-preview thead th {
    background: var(--surface-2);
  }

  .openspec-charts {
    display: grid;
    gap: 18px;
    margin-top: 18px;
  }
  .openspec-chart-block h4 {
    margin: 0 0 4px;
  }
  .openspec-chart {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 8px 0;
  }
  .openspec-chart-table {
    border-collapse: collapse;
    font-size: 12px;
  }
  .openspec-chart-table th,
  .openspec-chart-table td {
    border-bottom: 1px solid var(--line);
    padding: 2px 12px 2px 0;
    text-align: left;
  }
  /* One change's history as ADR 0033's mockup draws it
     (the-change-timeline-looks-like-the-mockup): the toolbar, then the rail
     of moments beside a Tasks tile and the dates, then what the rail cannot
     place. Tokens only, so both themes and the editor's draw it. */
  .openspec-timeline-screen {
    display: grid;
    gap: 20px;
  }

  /* Metro draws a select as wide as its row; the mockup's picker is one
     control of the toolbar's row. */
  .openspec-timeline-toolbar .openspec-timeline-picker {
    flex: 0 1 360px;
    width: 360px;
    min-width: 0;
    max-width: 100%;
  }

  .openspec-timeline-stale {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    font-size: 13px;
    color: var(--muted);
  }

  .openspec-timeline-stale input {
    width: 64px;
  }

  .openspec-change-timeline {
    display: grid;
    gap: 20px;
  }

  .openspec-change-timeline-heading h2 {
    margin: 0 0 4px;
    font-size: 24px;
    font-weight: 300;
    color: var(--heading);
    overflow-wrap: anywhere;
  }

  .openspec-change-timeline-heading p {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .openspec-change-timeline-columns {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .openspec-change-timeline-side {
    display: grid;
    gap: 20px;
  }

  /* The rail: a line down the left, a dot at each moment, the time above
     what happened. The last moment's line stops at its dot. */
  .openspec-change-timeline-rail {
    margin: 0;
    padding: 20px 24px 8px 32px;
    list-style: none;
  }

  .openspec-change-timeline-moment {
    position: relative;
    padding: 0 0 22px 24px;
  }

  .openspec-change-timeline-moment::before {
    content: "";
    position: absolute;
    top: 6px;
    bottom: 0;
    left: 0;
    width: 1px;
    background: var(--line-strong);
  }

  .openspec-change-timeline-moment:last-child::before {
    display: none;
  }

  .openspec-change-timeline-moment::after {
    content: "";
    position: absolute;
    top: 2px;
    left: -5px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--cobalt);
    box-shadow: 0 0 0 3px var(--surface);
  }

  .openspec-change-timeline-moment--proposed::after { background: var(--steel); }
  .openspec-change-timeline-moment--archived::after { background: var(--emerald); }

  .openspec-change-timeline-when {
    display: block;
    margin-top: -2px;
    font-size: 12px;
    color: var(--muted);
  }

  .openspec-change-timeline-what {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin-top: 3px;
    font-size: 14px;
    color: var(--heading);
    overflow-wrap: anywhere;
  }

  .openspec-change-timeline-task {
    display: flex;
    flex: 1 1 auto;
    gap: 10px;
    min-width: 0;
    max-width: 100%;
  }

  .openspec-change-timeline-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .openspec-change-timeline-number {
    flex: none;
    min-width: 28px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .openspec-change-timeline .badge.openspec-change-timeline-badge {
    position: static;
    display: inline-block;
    padding: 2px 7px;
    border: 0;
    border-radius: 3px;
    background: var(--steel);
    color: var(--steel-ink);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .openspec-change-timeline .badge.openspec-change-timeline-badge--archived { background: var(--emerald); color: var(--emerald-ink); }
  .openspec-change-timeline .badge.openspec-change-timeline-badge--stale { background: var(--amber); color: var(--amber-ink); }

  .openspec-change-timeline-group-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 3px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--heading);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .openspec-change-timeline-chevron {
    color: var(--muted);
  }

  .openspec-change-timeline-group {
    display: flex;
    flex-direction: column;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    font-size: 13px;
    color: var(--ink);
  }

  .openspec-change-timeline-group > li {
    padding: 7px 10px;
  }

  .openspec-change-timeline-group > li + li {
    border-top: 1px solid var(--line);
  }

  /* The tile takes the site's green once every task is done. */
  .openspec-change-timeline-tile--done .openspec-tile-icon {
    background: var(--emerald);
    color: var(--emerald-ink);
  }

  .openspec-change-timeline-dates {
    margin: 0;
    padding: 4px 0;
  }

  .openspec-change-timeline-dates > div {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 12px;
    padding: 8px 16px;
  }

  .openspec-change-timeline-dates dt {
    font-size: 13px;
    color: var(--muted);
  }

  .openspec-change-timeline-dates dd {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: 0;
  }

  .openspec-change-timeline-date {
    font-size: 14px;
    color: var(--heading);
  }

  .openspec-change-timeline-source {
    font-size: 12px;
    color: var(--muted);
  }

  .openspec-change-timeline-list {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
    color: var(--ink);
  }

  .openspec-change-timeline-list > li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
  }

  .openspec-change-timeline-list > li + li {
    border-top: 1px solid var(--line);
  }

  .openspec-change-timeline-document + .openspec-change-timeline-document {
    border-top: 1px solid var(--line);
  }

  .openspec-change-timeline-document > summary {
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--heading);
    cursor: pointer;
  }

  .openspec-change-timeline-document-body {
    padding: 0 16px 12px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink);
  }

  /* The editor's panel is usually half a window: one column there. */
  @media (max-width: 760px) {
    .openspec-change-timeline-columns {
      grid-template-columns: minmax(0, 1fr);
    }

    .openspec-timeline-stale {
      margin-left: 0;
    }
  }

  /* A count is a figure standing beside other figures, so each is a tile
     (the-web-ui-screens-wear-metro 3.1): a coloured block holding an icon,
     then the label and the number. Wrapping rather than a fixed row, so a
     narrow window stacks them instead of scrolling. */
  /* The site's KPI tile (the-shell-wears-the-site-frame 3.2): a coloured
     block the height of the tile holding the icon, then the label and a
     large figure. Each tile takes the next of the site's hues. */
  .openspec-overview-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 16px;
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
  }

  .openspec-overview-tile,
  .openspec-tile {
    display: flex;
    align-items: stretch;
    min-height: 96px;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .openspec-overview-tile-icon,
  .openspec-tile-icon {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 84px;
    background: var(--cobalt);
    color: var(--cobalt-ink);
    font-size: 34px;
  }

  .openspec-overview-tile:nth-child(2) .openspec-overview-tile-icon { background: var(--steel); color: var(--steel-ink); }
  .openspec-overview-tile:nth-child(3) .openspec-overview-tile-icon { background: var(--indigo); color: var(--indigo-ink); }
  .openspec-overview-tile:nth-child(4) .openspec-overview-tile-icon { background: var(--emerald); color: var(--emerald-ink); }

  .openspec-overview-tile-text,
  .openspec-tile-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 0;
    padding: 10px 14px;
  }

  .openspec-overview-tile-label,
  .openspec-tile-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }

  .openspec-overview-tile-value,
  .openspec-tile-value {
    font-size: 28px;
    font-weight: 600;
    line-height: 1.15;
    color: var(--heading);
    font-variant-numeric: tabular-nums;
  }

  .openspec-tile-note {
    font-size: 12px;
    color: var(--muted);
  }

  /* Several changes over one axis of days (the-web-ui-screens-wear-metro
     2.3). A grid, not a lane: the first column names the change and stays
     put while the days scroll, and an event sits in the column of the day
     it happened, so a position can be read back as a date. */
  .openspec-multi-timeline-scroll {
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .openspec-multi-timeline-grid {
    display: grid;
    grid-template-columns: var(--multi-timeline-name) repeat(var(--days), var(--multi-timeline-day));
    align-items: center;
  }

  .openspec-multi-timeline-corner,
  .openspec-multi-timeline-lane-label {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--surface);
  }

  .openspec-multi-timeline-day {
    font-size: 11px;
    color: var(--muted);
    text-align: center;
    padding: 0 2px 6px;
    white-space: nowrap;
  }

  .openspec-multi-timeline-row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    min-height: 28px;
    border-top: 1px solid var(--line);
  }

  .openspec-multi-timeline-axis {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-size: 12px;
    margin-bottom: 8px;
  }

  .openspec-multi-timeline-lane-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    padding-right: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .openspec-multi-timeline-track {
    position: relative;
    height: 28px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: 8px;
  }

  .openspec-multi-timeline-point {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    line-height: 1;
  }

  .openspec-multi-timeline-point-created {
    color: var(--muted);
  }

  .openspec-multi-timeline-point-task {
    color: var(--primary);
  }

  .openspec-multi-timeline-point-archived {
    color: var(--danger);
  }

  @media (max-width: 760px) {
    .openspec-shell-grid { grid-template-columns: 1fr; }
    .openspec-editor-grid { grid-template-columns: 1fr; }
    .openspec-standalone-app,
    .openspec-extension-app { margin: 10px auto; padding: 10px; }
  }

  /* The pipeline picture. Every position here came from core: the
     element carries --pipeline-w/h and each card carries --x/--y/--w/--h,
     all in the layout's abstract units, and this turns a unit into a
     length. Nothing is measured (ADR 0025).

     A unit is a rem and deliberately not an em. A custom property holds
     a token, not a computed length, so --u set to 1em would resolve
     against the font-size of whichever element used it — and the shell
     fixes body font-size at 14px anyway, so an em would not follow the
     reader's browser setting at all. A rem does. */
  .openspec-pipeline-scroll {
    overflow-x: auto;
    /* Its own container, so the page body never scrolls sideways — the
       same rule the shell's tables already follow. */
    max-width: 100%;
  }

  .openspec-pipeline-picture {
    /* Times the picture's zoom, which every length on a card is
       multiplied by as well, so a zoom scales the drawing and its text
       together and changes no layout unit (a-card-opens-to-its-tasks). */
    --u: calc(1rem * var(--pipeline-zoom, 1));
    position: relative;
    width: calc(var(--u) * var(--pipeline-w));
    height: calc(var(--u) * var(--pipeline-h));
    margin: 12px 0;
  }

  /* No box of its own: in the wide view a lane exists only to group,
     and its cards are placed by coordinate. It becomes a real container
     at phone width, at the bottom of this file. */
  .openspec-pipeline-lane { display: contents; }
  .openspec-pipeline-lane-heading { display: none; }

  .openspec-pipeline-edges {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    /* A lane below the grid is inside the reported extent, but a stroke
       has width and half of it falls outside. */
    overflow: visible;
  }

  .openspec-pipeline-edges path {
    stroke: var(--line-strong);
    stroke-width: 0.1;
    stroke-linejoin: round;
  }

  .openspec-pipeline-node {
    position: absolute;
    left: calc(var(--u) * var(--x));
    top: calc(var(--u) * var(--y));
    width: calc(var(--u) * var(--w));
    height: calc(var(--u) * var(--h));
    /* Sets no font-size of its own, on purpose: --u is a token, and a
       card that changed its font-size would still be fine with rem but
       would silently break the moment anybody made the unit an em. Its
       lines set their own sizes, in rem. */
    font-family: inherit;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    /* Fixed size, so text beyond it is clipped rather than allowed to
       move the card's neighbours away from the coordinates core gave.
       What fits is decided before drawing: every vertical length on a
       card is one core counts its lines by (PIPELINE_CARD_REM,
       the-pipeline-shows-what-it-has-read), so a card draws whole lines
       and never half of one. The text stays in the DOM: a card must not
       be able to remove a fact the change is required to state. */
    overflow: hidden;
    text-align: left;
    padding: calc(${PIPELINE_CARD_REM.paddingBlock}rem * var(--pipeline-zoom, 1)) 8px;
    border: 1px solid var(--line-strong);
    border-top-width: calc(${PIPELINE_CARD_REM.borderBlock}rem * var(--pipeline-zoom, 1));
    border-bottom-width: calc(${PIPELINE_CARD_REM.borderBlock}rem * var(--pipeline-zoom, 1));
    border-left-width: 4px;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
  }

  .openspec-pipeline-node:hover { border-color: var(--primary-soft); }

  /* The card's name is the control that opens the change. It reads as the
     card's title, not as a button, and takes the name line core counts. */
  /* A row, so its icon and the name share the one name line. As a block the
     icon took a line of its own once the icon font drew it, and pushed the
     name down over the state line of a card whose height does not grow
     (the-web-ui-screens-wear-metro 7.4). */
  .openspec-pipeline-node-open {
    flex-shrink: 0;
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .openspec-pipeline-node-open > [class^="openspec-icon-"] {
    flex: none;
    font-size: calc(0.75rem * var(--pipeline-zoom, 1));
  }

  /* A card's controls, in the row core subtracts from its lines. */
  .openspec-pipeline-node-controls {
    display: flex;
    flex-shrink: 0;
    align-self: stretch;
    gap: 4px;
    height: calc(${PIPELINE_CARD_REM.controlsLine}rem * var(--pipeline-zoom, 1));
    line-height: calc(${PIPELINE_CARD_REM.controlsLine}rem * var(--pipeline-zoom, 1));
    margin-top: auto;
    overflow: hidden;
  }

  .openspec-pipeline-node-controls button {
    font-size: calc(0.6875rem * var(--pipeline-zoom, 1));
    line-height: 1;
    padding: 0 6px;
    white-space: nowrap;
  }

  /* The card's first line: its name, and where it has tasks, the control
     that shows them. One line, the name line core counts. */
  .openspec-pipeline-node-head {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    align-self: stretch;
    min-width: 0;
    height: calc(${PIPELINE_CARD_REM.nameLine}rem * var(--pipeline-zoom, 1));
  }

  /* The name takes the line, and gives up width to the control beside it.
     Written by position, so the name's own rule stays its first. */
  .openspec-pipeline-node-head > button:first-child,
  .openspec-pipeline-node-head > span:first-child { flex: 1 1 auto; min-width: 0; }

  .openspec-pipeline-node-disclosure {
    flex: 0 0 auto;
    font-size: calc(0.625rem * var(--pipeline-zoom, 1));
    line-height: 1;
    padding: 1px 4px;
    white-space: nowrap;
  }

  /* An open card's tasks (a-card-opens-to-its-tasks). Each heading and
     each row is one line of the height core adds for it, so an open card
     draws every row whole, and the cards below it move by exactly that. */
  .openspec-pipeline-node-tasks {
    flex-shrink: 0;
    align-self: stretch;
    min-width: 0;
  }

  .openspec-pipeline-task-section {
    margin: 0;
    /* The rows' gutter, which a rail runs in across the heading. */
    padding-left: 10px;
    height: calc(${PIPELINE_CARD_REM.sectionRow}rem * var(--pipeline-zoom, 1));
    line-height: calc(${PIPELINE_CARD_REM.sectionRow}rem * var(--pipeline-zoom, 1));
    font-size: calc(0.6875rem * var(--pipeline-zoom, 1));
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .openspec-pipeline-tasks { margin: 0; padding: 0; list-style: none; }

  .openspec-pipeline-task {
    position: relative;
    display: flex;
    gap: 4px;
    min-width: 0;
    padding-left: 10px;
    height: calc(${PIPELINE_CARD_REM.taskRow}rem * var(--pipeline-zoom, 1));
    line-height: calc(${PIPELINE_CARD_REM.taskRow}rem * var(--pipeline-zoom, 1));
    font-size: calc(0.6875rem * var(--pipeline-zoom, 1));
    color: var(--muted);
    white-space: nowrap;
  }

  /* The row a run is on, or is probably next: said in its word, and set
     apart by weight, never by colour alone. */
  .openspec-pipeline-task--in-hand { color: var(--ink); font-weight: 700; }

  /* The thin rail from a row to the row listed after it. It never leaves
     the card, and is hidden from assistive technology: the list's own
     order already says next. */
  .openspec-pipeline-task-rail {
    position: absolute;
    left: 3px;
    top: 50%;
    height: 100%;
    border-left: 1px solid var(--line-strong);
  }

  /* From a section's last row, through the next section's heading, to
     that section's first row: the heading is one section row tall. */
  .openspec-pipeline-task-rail--across {
    height: calc(100% + ${PIPELINE_CARD_REM.sectionRow}rem * var(--pipeline-zoom, 1));
  }

  .openspec-pipeline-task-number,
  .openspec-pipeline-task-word { flex: 0 0 auto; }
  .openspec-pipeline-task-word { font-style: italic; }

  .openspec-pipeline-task-text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ink);
  }

  /* What the picture's lines mean, above a picture that has one. */
  .openspec-pipeline-legend { margin: 8px 0 0; padding-left: 0; list-style: none; }
  .openspec-pipeline-legend li { display: flex; align-items: center; gap: 6px; }
  .openspec-pipeline-legend-edge { flex: 0 0 24px; border-top: 2px solid var(--line-strong); }
  .openspec-pipeline-legend-rail { flex: 0 0 1px; height: 12px; border-left: 1px solid var(--line-strong); }

  .openspec-pipeline-stop-form {
    margin: 12px 0;
    padding: 8px 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .openspec-pipeline-stop-form label { display: grid; gap: 4px; }

  /* The run a card's Start opened: its dialog, then its chain, beneath the
     picture where Start was pressed. */
  .openspec-pipeline-run-layer {
    margin: 12px 0;
    padding: 8px 12px;
    border: 1px solid var(--primary);
    border-radius: var(--radius);
    background: var(--surface);
  }

  /* State is carried by the word inside the card first; these only
     agree with it. A reader who cannot tell two hues apart has already
     been told which state this is. */
  .openspec-pipeline-node[data-state="running"] {
    background: var(--primary-bg);
    border-left-color: var(--primary);
  }

  .openspec-pipeline-node[data-state="blocked"] {
    background: var(--warn-bg);
    border-left-color: var(--warn);
  }

  /* The states a card says since a-card-says-what-its-change-is-doing,
     each with a state-word token of its own. The word still differs in
     every case, and the edge's style differs where two states share a
     hue: waiting is dashed, a stop is dotted. */
  .openspec-pipeline-node[data-state="waiting"] {
    --pipeline-state-ink: var(--primary);
    background: var(--primary-bg);
    border-left-color: var(--primary);
    border-left-style: dashed;
  }

  .openspec-pipeline-node[data-state="failed"] {
    --pipeline-state-ink: var(--bad);
    background: var(--bad-bg);
    border-left-color: var(--bad);
  }

  .openspec-pipeline-node[data-state="stopped"] {
    --pipeline-state-ink: var(--bad);
    border-left-color: var(--bad);
    border-left-style: dotted;
  }

  .openspec-pipeline-node[data-state="done"] {
    border-left-color: var(--good);
  }

  .openspec-pipeline-node-name {
    font-size: calc(0.8125rem * var(--pipeline-zoom, 1));
    line-height: calc(${PIPELINE_CARD_REM.nameLine}rem * var(--pipeline-zoom, 1));
    font-weight: 600;
    /* The part a reader scans for gets the room, and never shrinks. */
    flex-shrink: 0;
    align-self: stretch;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Inside the open control's row the name gives way to the icon and ends
     in an ellipsis, rather than keeping its full width and wrapping below
     it. After the rule above, which pipeline-card-style.test.ts reads as the
     name's own. */
  .openspec-pipeline-node-open > .openspec-pipeline-node-name {
    flex: 1 1 auto;
    min-width: 0;
  }

  .openspec-pipeline-node-state {
    font-size: calc(0.6875rem * var(--pipeline-zoom, 1));
    line-height: calc(${PIPELINE_CARD_REM.stateLine}rem * var(--pipeline-zoom, 1));
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--pipeline-state-ink, var(--muted));
  }

  /* One line each, cut with an ellipsis at the card's width: a wrapped
     line would make how many lines fit depend on the text and the font,
     which nothing knows without measuring. Every line is whole in the
     card's title. */
  .openspec-pipeline-node-detail {
    font-size: calc(0.6875rem * var(--pipeline-zoom, 1));
    line-height: calc(${PIPELINE_CARD_REM.detailLine}rem * var(--pipeline-zoom, 1));
    flex-shrink: 0;
    align-self: stretch;
    display: flex;
    gap: 4px;
    min-width: 0;
    color: var(--muted);
  }

  .openspec-pipeline-node-detail-text {
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* How many more lines the card holds for its title and for assistive
     technology, on the last line it draws. */
  .openspec-pipeline-node-more {
    flex: 0 0 auto;
    padding: 0 4px;
    border-radius: var(--radius-sm);
    background: var(--surface-3);
    color: var(--ink);
    font-weight: 600;
  }

  /* Past the card's budget: kept for assistive technology and the title,
     not drawn. The usual visually-hidden treatment rather than
     display: none, which would take the text out of the card's
     accessible name as well. */
  .openspec-pipeline-node-detail--beyond {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .openspec-pipeline-cycles {
    border: 1px solid var(--warn);
    background: var(--warn-bg);
    border-radius: var(--radius);
    padding: 8px 12px;
    margin: 12px 0;
  }

  .openspec-pipeline-cycles ul { margin: 4px 0 0; padding-left: 20px; }

  /* Which branch the picture was read from, and what this directory's
     runs say. */
  .openspec-pipeline-reading { margin: 8px 0; }
  .openspec-pipeline-reading ul,
  .openspec-pipeline-directory ul { margin: 2px 0 6px; padding-left: 20px; }

  /* Every other working directory, beneath this one. Recessed, and the
     recess only agrees with a fact the markup already states: those
     cards are not controls and carry no handler. */
  .openspec-pipeline-others {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid var(--line-strong);
  }
  .openspec-pipeline-others-heading { margin: 0 0 4px; font-size: 14px; }
  .openspec-pipeline-directory {
    margin: 12px 0;
    padding: 8px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
  }
  .openspec-pipeline-directory-label { margin: 0 0 2px; font-size: 13px; }
  /* A foreign card sizes its lines by the same rem as a local one, so a
     div and a button hold the same lines in the same height. */
  .openspec-pipeline-node--foreign { cursor: default; border-style: dashed; }
  .openspec-pipeline-node--foreign:hover { border-color: var(--line-strong); }
  /* A different git author is said in words first; this agrees. */
  .openspec-pipeline-directory-holder[data-author-differs="true"] {
    border-left: 4px solid var(--warn);
    padding-left: 6px;
  }

  .openspec-hints { margin-top: 16px; }
  .openspec-hints h3 { margin: 0 0 8px; font-size: 14px; }
  .openspec-hints-list { margin: 0; padding: 0; list-style: none; }
  .openspec-hint { margin-bottom: 12px; }
  .openspec-hint .openspec-shell-note { margin: 2px 0 6px; }

  /* What a stopped delegated run's agent last said, beneath its outcome.
     Pre-formatted as the agent wrote it, wrapped so a long line does not
     widen the page, and scrolled inside its own box past a few lines. */
  .openspec-delegated-stderr { margin: 4px 0 8px; }
  .openspec-delegated-stderr summary { cursor: pointer; color: var(--muted); }
  .openspec-delegated-stderr pre {
    margin: 4px 0 0;
    padding: 6px 8px;
    max-height: 14em;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }

  /* A command is one long line, and the page must not scroll sideways
     at phone width — pipeline.spec.ts asserts exactly that, and is what
     caught this: a pre element keeps its line intact by default, so the
     command ran off the side of a 400px viewport. Wrapped rather than
     scrolled: a command whose end a reader has to scroll to is one they
     will copy incorrectly.

     No backticks anywhere in this file: it is one template literal, and
     a backtick in a comment ends the stylesheet. */
  .openspec-hint-command {
    margin: 0 0 4px;
    padding: 6px 8px;
    background: rgba(127, 127, 127, 0.12);
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  /* A harness settings panel narrower than its five columns — an editor
     panel beside the code, a phone — reads each stage as a block of
     labelled fields: the column header goes, and each cell draws its
     column's name above its field. */
  @media (max-width: 900px) {
    .openspec-stage-head {
      display: none;
    }

    .openspec-stage-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
    }

    .openspec-stage-name,
    .openspec-stage-mechanical,
    .openspec-stage-cell--agent {
      grid-column: 1 / -1;
    }

    .openspec-stage-cell[data-label]::before {
      content: attr(data-label);
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
    }

    .openspec-harness-band {
      grid-template-columns: 1fr;
      gap: 18px;
    }

    .openspec-panel-head--icon {
      flex-wrap: wrap;
    }

    .openspec-panel-head--icon .openspec-panel-head-note {
      margin-left: 0;
      text-align: left;
    }

    .openspec-harness-foot-file {
      flex-basis: 100%;
      margin-left: 0;
    }
  }

  /* LAST in this layer on purpose. These selectors have the same
     specificity as the ones they override, and at equal specificity the
     later rule wins — placed earlier, the whole block did nothing.

     At phone width the two-column settings pane becomes one column and
     every control gives up its preferred width. Without it the page
     scrolled sideways by 274px at 400px wide, found by sweeping every
     tab after the restyle and never checked before. */
  @media (max-width: 720px) {
    .openspec-summary-pair {
      grid-template-columns: 1fr;
    }

    .openspec-change-columns {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .openspec-change-columns > :nth-child(3),
    .openspec-change-columns > :nth-child(4) {
      display: none;
    }

    .openspec-shell-grid {
      grid-template-columns: 1fr;
    }

    .openspec-shell-field select,
    .openspec-ai-panel-controls select,
    .openspec-shell-field input {
      width: 100%;
      min-width: 0;
    }

    /* The picture becomes headed lanes. Four columns of cards do not fit
       a phone in any implementation, and shrinking until it is
       technically present and practically unreadable is the worse
       answer. Nothing is lost: each card already states in words what it
       waits on, which is what the edges illustrate. */
    .openspec-pipeline-picture {
      width: auto;
      height: auto;
    }

    .openspec-pipeline-edges { display: none; }

    .openspec-pipeline-lane { display: block; margin-bottom: 16px; }

    .openspec-pipeline-lane-heading {
      display: block;
      margin: 0 0 6px;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }

    .openspec-pipeline-node {
      position: static;
      width: 100%;
      height: auto;
      /* Nothing is clipped here: there is room to run on, and the card
         is no longer holding a coordinate for anything else. */
      overflow: visible;
      margin-bottom: 8px;
    }

    .openspec-pipeline-node-name { white-space: normal; }

    /* Room to run on: every line is drawn, wrapped, and none is left
       beyond the card or counted. */
    .openspec-pipeline-node-detail--beyond {
      position: static;
      width: auto;
      height: auto;
      margin: 0;
      overflow: visible;
      clip: auto;
      white-space: normal;
    }
    .openspec-pipeline-node-detail-text { white-space: normal; }
    .openspec-pipeline-node-more { display: none; }
    /* Room to run on: controls wrap rather than being cut. */
    .openspec-pipeline-node-controls { height: auto; flex-wrap: wrap; }
    /* An open card lists its rows in its lane, each wrapped, with no fixed
       height (a-card-opens-to-its-tasks). */
    .openspec-pipeline-node-head { height: auto; }
    .openspec-pipeline-task,
    .openspec-pipeline-task-section { height: auto; white-space: normal; }
  }
`;

export const vscodeThemeCss = `
  :root {
    color-scheme: light dark;
    --bg: var(--vscode-editor-background);
    --bg-accent: var(--vscode-editor-background);
    --surface: var(--vscode-sideBar-background, var(--vscode-editor-background));
    --surface-2: var(--vscode-input-background, var(--vscode-editorWidget-background));
    --ink: var(--vscode-editor-foreground);
    --muted: var(--vscode-descriptionForeground);
    --primary: var(--vscode-button-background);
    --primary-ink: var(--vscode-button-foreground);
    --danger: var(--bad);
    --line: var(--vscode-panel-border, var(--vscode-contrastBorder, transparent));
    --radius: 4px;
    --shadow: none;

    /* Every token the shell layer declares is defined here too. A name
       present in one layer and missing from the other renders this
       panel with no value at all — which nothing used to catch, and
       shell-ui.test.ts now does. Each maps to the editor's own
       theme rather than to a colour of ours: repainting somebody's
       editor would override a choice that is theirs (ADR 0023
       decision 4). */
    --surface-3: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    --primary-soft: var(--vscode-button-hoverBackground, var(--vscode-button-background));
    --primary-bg: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    --good: var(--vscode-gitDecoration-addedResourceForeground, var(--vscode-charts-green, var(--vscode-editor-foreground)));
    --good-bg: var(--vscode-diffEditor-insertedTextBackground, transparent);
    --warn: var(--vscode-editorWarning-foreground, var(--vscode-charts-yellow, var(--vscode-editor-foreground)));
    --warn-bg: var(--vscode-inputValidation-warningBackground, transparent);
    --bad: var(--vscode-errorForeground);
    --bad-bg: var(--vscode-inputValidation-errorBackground, transparent);
    --line-strong: var(--vscode-contrastBorder, var(--vscode-input-border, var(--vscode-panel-border, transparent)));
    --radius-sm: 2px;
    /* the-shell-wears-the-site-frame 1.3: a title in the editor's own
       foreground, a link in its link colour, and the current tab's mark in
       the colour VS Code marks its own active tab with. */
    --heading: var(--vscode-foreground, var(--vscode-editor-foreground));
    --link: var(--vscode-textLink-foreground, var(--vscode-foreground));
    --tab-accent: var(--vscode-tab-activeBorderTop, var(--vscode-focusBorder));

    /* The hue-and-ink pairs declared in shellThemeCss (3.1), mapped to the
       editor's own chart colours rather than repainted with ours (ADR 0023
       decision 4). No screen draws one of these yet, so no picture proves
       the pairing; each ink is the colour VS Code itself puts text on for
       that kind of fill. */
    --cobalt: var(--vscode-charts-blue, var(--vscode-button-background));
    --cobalt-ink: var(--vscode-button-foreground);
    --indigo: var(--vscode-charts-purple, var(--vscode-button-background));
    --indigo-ink: var(--vscode-button-foreground);
    --crimson: var(--vscode-charts-red, var(--vscode-errorForeground));
    --crimson-ink: var(--vscode-button-foreground);
    --green: var(--vscode-charts-green, var(--vscode-testing-iconPassed));
    --green-ink: var(--vscode-editor-background);
    --orange: var(--vscode-charts-orange, var(--vscode-charts-yellow));
    --orange-ink: var(--vscode-editor-background);
    --teal: var(--vscode-charts-blue);
    --teal-ink: var(--vscode-editor-background);
    --emerald: var(--vscode-charts-green);
    --emerald-ink: var(--vscode-editor-background);
    --amber: var(--vscode-charts-yellow);
    --amber-ink: var(--vscode-editor-background);
    --steel: var(--vscode-descriptionForeground);
    --steel-ink: var(--vscode-editor-background);

    /* The day grid's tracks are lengths, not colours, so they are the
       shell's values verbatim here too. */
    --multi-timeline-name: 14rem;
    --multi-timeline-day: 2.25rem;

    /* Control widths are not colours and are not the editor's to
       decide, so they are the shell's values verbatim. */
    --w-amount: 6.5rem;
    --w-name: 14rem;
    --w-sentence: 26rem;
  }

  /* Every variable the derived Metro copy reads from its palette, set from
     the editor theme (the-web-ui-wears-metro design decision 6). Unlayered,
     so it wins over Metro's light and dark palettes in any theme, built-in
     or not; vscode-metro-mapping.test.ts fails when Metro reads a variable
     this block does not set. Sizes follow the editor's density rather than
     Metro's 36px forms. No colour is written here, only the theme's own. */
  .openspec-metro {
    --default-background: var(--vscode-checkbox-background, var(--vscode-input-background));
    --border-color: var(--vscode-widget-border, var(--vscode-panel-border, transparent));
    --control-height-normal: 28px;
    --control-height-small: 22px;

    --button-background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
    --button-color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
    --button-border-radius: 2px;
    --button-disabled-opacity: 0.5;
    --button-font-size: var(--vscode-font-size);
    --button-group-active-background: var(--vscode-button-background);
    --button-group-active-color: var(--vscode-button-foreground);

    --input-background: var(--vscode-input-background);
    --input-background-disabled: var(--vscode-input-background);
    --input-border-color: var(--vscode-input-border, var(--vscode-contrastBorder, var(--vscode-panel-border, transparent)));
    --input-border-color-hover: var(--vscode-input-border, var(--vscode-focusBorder));
    --input-border-radius: 2px;
    --input-box-shadow: transparent;
    --input-color: var(--vscode-input-foreground);
    --input-color-disabled: var(--vscode-disabledForeground);
    --input-font-size: 1em;
    --input-height: var(--control-height-normal);
    --input-invalid-color: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground));
    --input-valid-color: var(--vscode-testing-iconPassed, var(--vscode-charts-green));
    --material-input-border-color: var(--border-color);
    --material-input-border-color-hover: var(--vscode-focusBorder);
    --material-input-color: var(--vscode-input-foreground);
    --material-input-placeholder-color: var(--vscode-input-placeholderForeground);

    --checkbox-background-disabled: var(--vscode-input-background);
    --checkbox-border-radius: 3px;
    --checkbox-color: var(--vscode-checkbox-foreground, var(--vscode-foreground));
    --checkbox-color-disabled: var(--vscode-disabledForeground);
    --checkbox-focus-color: var(--vscode-focusBorder);
    --checkbox-size: 18px;
    --radio-background-disabled: var(--vscode-input-background);
    --radio-color: var(--vscode-checkbox-foreground, var(--vscode-foreground));
    --radio-color-disabled: var(--vscode-disabledForeground);
    --radio-focus-color: var(--vscode-focusBorder);
    --radio-size: 18px;

    --select-border-radius: 2px;
    --select-button-background: transparent;
    --select-button-background-hover: transparent;
    --select-button-color: var(--vscode-dropdown-foreground);
    --select-button-color-hover: var(--vscode-dropdown-foreground);
    --select-focus-color: var(--vscode-list-focusBackground, transparent);

    --textarea-border-radius: 2px;
    --textarea-color: var(--vscode-input-foreground);
    --textarea-font-size: var(--vscode-font-size);

    --table-body-font-size: var(--vscode-font-size);
    --table-caption-font-size: var(--vscode-font-size);
    --table-head-font-size: var(--vscode-font-size);
    --table-border-color: var(--vscode-panel-border, var(--vscode-contrastBorder, transparent));
    --table-color: var(--vscode-foreground);
    --table-header-background: var(--vscode-editorWidget-background, transparent);
    --table-header-color: var(--vscode-foreground);
    --table-inspector-background: var(--vscode-editorWidget-background);
    --table-inspector-border-color: var(--vscode-editorWidget-border, transparent);
    --table-inspector-border-radius: 4px;
    --table-inspector-color: var(--vscode-foreground);
    --table-selected-background: var(--vscode-list-activeSelectionBackground);
    --table-selected-color: var(--vscode-list-activeSelectionForeground);
    --table-striped-background: var(--vscode-list-hoverBackground, transparent);

    /* panel, card, badge and timeline (the-web-ui-wears-more-metro 1.4): the
       18 variables the derived copy reads for the four families this change
       adds. No screen draws one yet, but vscode-metro-mapping.test.ts checks
       the mapping is complete before a screen depends on it. */
    --panel-background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    --panel-color: var(--vscode-foreground);
    --panel-border-color: var(--vscode-widget-border, var(--vscode-panel-border, transparent));
    --panel-border-radius: 2px;
    --panel-header-background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-editorWidget-background));
    --panel-header-color: var(--vscode-foreground);
    --panel-header-icon-background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-editorWidget-background));
    --panel-header-icon-color: var(--vscode-icon-foreground, var(--vscode-foreground));

    --card-background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    --card-color: var(--vscode-foreground);
    --card-border-radius: 2px;
    --card-header-background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-editorWidget-background));
    --card-header-color: var(--vscode-foreground);
    --card-footer-background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    --card-footer-color: var(--vscode-foreground);
    --card-button-border-color: var(--vscode-widget-border, var(--vscode-panel-border, transparent));

    --badge-background: var(--vscode-badge-background);
    --badge-color: var(--vscode-badge-foreground);
    --badge-border-radius: 2px;

    --timeline-marker-color: var(--vscode-button-background);
    --timeline-color: var(--vscode-foreground);
    --timeline-time-color: var(--vscode-descriptionForeground);
  }

  /* A neutral button keeps an edge where the theme draws one. Default Dark
     Modern's secondary button ground is transparent, and without the
     theme's button border the AI panel's "Reload changes" read as a label,
     measured in the Extension Development Host. Metro's own border takes
     the ground's colour, which is that same transparency. */
  /* A high-contrast theme draws a button as a ground no different from the
     page, and outlines it with the contrast border instead; in Default High
     Contrast "Apply" read as text until that border was drawn. The primary
     and alert selectors are named so this wins over the shell's own
     transparent border on them. */
  .openspec-extension-app .button,
  .openspec-extension-app .button.primary,
  .openspec-extension-app .button.alert {
    border-color: var(--vscode-contrastBorder, var(--vscode-button-border, transparent));
  }

  /* An action that stops or discards, in the editor's own error colour. The
     error border is the one the theme draws behind white-on-colour text; the
     error foreground is a text colour and too light to sit under text. */
  .openspec-extension-app .button.alert {
    color: var(--vscode-button-foreground);
    background: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground));
  }

  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-editor-foreground);
    background: var(--vscode-editor-background);
  }

  .openspec-extension-app {
    max-width: none;
    margin: 0 auto;
    padding: 14px;
  }

  .openspec-extension-app .openspec-shell-headline,
  .openspec-extension-app .openspec-shell-panel,
  .openspec-extension-app .openspec-ai-panel,
  .openspec-extension-app .openspec-status-card,
  .openspec-extension-app .openspec-data-card,
  .openspec-extension-app .openspec-diff-body,
  .openspec-extension-app .openspec-overview-table,
  .openspec-extension-app .openspec-md-preview,
  .openspec-extension-app .openspec-run-insights-highlight {
    background: var(--surface);
  }

  /* A field's colour, ground and border are Metro's native-field rules,
     reading the --input-* variables the mapping above sets from the same
     --vscode-input-* colours. The placeholder is the one thing Metro does
     not colour. */
  .openspec-extension-app input::placeholder,
  .openspec-extension-app textarea::placeholder {
    color: var(--vscode-input-placeholderForeground);
  }

  .openspec-extension-app input:focus,
  .openspec-extension-app textarea:focus,
  .openspec-extension-app select:focus,
  .openspec-extension-app button:focus {
    outline-color: var(--vscode-focusBorder);
  }

  /* The editor's primary button colours go to the one primary action, as
     the shell's accent does standalone. Every other button is drawn from
     Metro's variables, which the mapping below sets from the theme. */
  .openspec-extension-app .button.primary,
  .openspec-extension-app .openspec-editor-tabs button.is-active {
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
  }

  .openspec-extension-app .button.primary:hover:not(:disabled),
  .openspec-extension-app .openspec-editor-tabs button.is-active:hover {
    background: var(--vscode-button-hoverBackground);
  }

  .openspec-extension-app .openspec-ai-panel-banner,
  .openspec-extension-app .openspec-event--failed,
  .openspec-extension-app .openspec-event--stderr {
    color: var(--vscode-inputValidation-errorForeground, var(--ink));
    background: var(--vscode-inputValidation-errorBackground, var(--surface-2));
    border-color: var(--vscode-inputValidation-errorBorder, var(--danger));
  }

  .openspec-extension-app .openspec-run-insights,
  .openspec-extension-app .openspec-event--completed {
    background: color-mix(in srgb, var(--vscode-testing-iconPassed) 10%, var(--surface));
    border-color: color-mix(in srgb, var(--vscode-testing-iconPassed) 45%, var(--line));
  }

  .openspec-extension-app .openspec-usage-summary,
  .openspec-extension-app .openspec-usage-stage {
    background: var(--vscode-editorWidget-background, var(--surface-2));
    border-color: var(--vscode-editorWidget-border, var(--line));
  }

  .openspec-extension-app .openspec-status-meter {
    background: var(--vscode-progressBar-background);
    opacity: 0.35;
  }

  .openspec-extension-app .openspec-status-meter-fill {
    background: var(--vscode-progressBar-background);
    opacity: 1;
  }

  .openspec-extension-app .openspec-event,
  .openspec-extension-app .openspec-diff-body,
  .openspec-extension-app .openspec-editor-textarea,
  .openspec-extension-app .openspec-md-preview code {
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
  }

  .openspec-extension-app ::selection {
    color: var(--vscode-editor-selectionForeground);
    background: var(--vscode-editor-selectionBackground);
  }

  @media (forced-colors: active) {
    .openspec-extension-app .openspec-shell-headline,
    .openspec-extension-app .openspec-shell-panel,
    .openspec-extension-app .openspec-ai-panel {
      border-color: CanvasText;
    }
  }
`;
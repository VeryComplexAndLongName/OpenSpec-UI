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

    /* grounds, lightest surface last: the page sits UNDER its panels */
    --bg: #eef0f3;
    --bg-accent: #e6e9ee;
    --surface: #ffffff;
    --surface-2: #f5f7f9;
    --surface-3: #e9ecf0;

    /* text. --muted is set from the contrast requirement, not from
       taste: 6.0:1 on --surface, where the browser suite's axe run
       covers WCAG AA and a quieter palette fails first. */
    --ink: #1b1f24;
    --muted: #5a6470;

    /* One accent. Both steps carry white text, so both are measured
       against it: --primary 7.1:1, --primary-soft 5.5:1. The soft
       step was #2b8677 first and axe caught it at 4.39:1 — a hover
       state is a state the checker evaluates, and "it is only the
       hover" is how a palette fails AA in the one place nobody
       screenshots. */
    --primary: #0e6357;
    --primary-soft: #14766a;
    --primary-bg: #e7f1ef;
    --primary-ink: #ffffff;

    /* semantic, deliberately not the accent */
    --good: #16704a;
    --good-bg: #e6f2ea;
    --warn: #7d5412;
    --warn-bg: #f5edda;
    --bad: #a02b2b;
    --bad-bg: #fbeaea;
    --danger: var(--bad);

    /* edges. --line separates, --line-strong is for an edge that has
       to hold its own against a filled surface. */
    --line: #d7dbe1;
    --line-strong: #bcc3cc;

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

  .openspec-standalone-app,
  .openspec-extension-app {
    max-width: 980px;
    margin: 22px auto;
    padding: 18px;
    display: grid;
    gap: 14px;
  }

  /* A heading is not a card. It gets a rule under it and nothing
     else — ADR 0023 decision 2: where every block carries the same
     border, radius and shadow, none of them is emphasised. */
  .openspec-shell-headline {
    padding: 0 0 14px;
    border-bottom: 1px solid var(--line);
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

  .openspec-page-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  /* A navigation strip, not a row of buttons: the resting tab is
     plain text and the accent marks only the one you are on. */
  .openspec-page-tabs button {
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted);
    padding: 6px 10px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  .openspec-page-tabs button:hover {
    background: var(--surface-2);
    color: var(--ink);
  }

  .openspec-page-tabs button.is-active {
    background: var(--primary-bg);
    color: var(--primary);
    border-color: var(--line);
    font-weight: 600;
  }

  .openspec-page-tab-panel {
    display: grid;
    gap: 14px;
  }

  .openspec-page-tab-panel[hidden] {
    display: none;
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

  .openspec-shell-field input,
  .openspec-shell-field textarea,
  .openspec-shell-field select,
  .openspec-ai-panel-controls select,
  .openspec-ai-panel-controls button {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 5px 8px;
    font: inherit;
    font-weight: 400;
    letter-spacing: normal;
    color: var(--ink);
    background: var(--surface);
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

  /* Where a row is a name and a value and nothing else — a stage that
     runs mechanically — the name takes its own column instead of a
     line above the value. A settings pane is a two-column document,
     and making it one is what stops the page reading as an
     undifferentiated stack.

     Styled on the class the markup already carries rather than a new
     one: a rule written for a class nothing uses is a setting nothing
     reads. */
  /* The value column is minmax(0, 1fr), not 1fr. A grid track's default
     minimum is its item's min-content width, so a select whose widest
     option is "Claude CLI (ACP) — progress only, no permission gate
     (detected)" — 435px — pushed the whole field 18px past its panel.
     The sweep across every tab found it on the Change Editor; nothing
     asserted it. */
  [data-testid="harness-settings-view"] .openspec-shell-field {
    grid-template-columns: minmax(11rem, max-content) minmax(0, 1fr);
    gap: 4px 16px;
    align-items: baseline;
  }

  /* One rhythm down the whole pane. Without this the stage rows pack
     together while the fields around them are spaced, because only
     the plain fields are siblings of each other — the stages are each
     wrapped in a row of their own. */
  [data-testid="harness-settings-view"] .openspec-shell-field,
  [data-testid="harness-settings-view"] .openspec-harness-stage-row {
    margin-top: 10px;
  }

  [data-testid="harness-settings-view"] .openspec-harness-stage-row .openspec-shell-field {
    margin-top: 0;
  }

  .openspec-harness-stage-row .openspec-shell-note {
    font-size: 12px;
  }

  .openspec-shell-version-footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
    text-align: center;
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

  /* In a settings section the separation is drawn as well as spaced:
     what you are editing ends, and the control that commits it
     begins. */
  [data-testid="harness-settings-view"] .openspec-ai-panel-controls {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
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

  /* An action carries more padding than a control that holds a value:
     it is pressed, not read, and a 5px target is not one. */
  .openspec-ai-panel-controls button {
    cursor: pointer;
    padding: 7px 14px;
    background: var(--primary);
    color: var(--primary-ink);
    border-color: transparent;
    font-weight: 600;
  }

  .openspec-ai-panel-controls button:hover:not(:disabled) {
    background: var(--primary-soft);
  }

  /* The focus ring sits on the accent here, so it has to be drawn
     against the button rather than in it — a quieter palette is
     exactly where a ring disappears into its own control. */
  .openspec-ai-panel-controls button:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    border-color: transparent;
  }

  .openspec-ai-panel-controls button[data-testid="cancel-button"] {
    background: var(--danger);
  }

  .openspec-ai-panel-controls button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
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
    background: var(--surface);
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
  }

  .openspec-diff-line--added { color: var(--good); }
  .openspec-diff-line--removed { color: var(--bad); }

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

  /* Changes/Archive lists: always sit inside a bounded, scrollable
     container (see openspec/changes/virtualize-change-lists/design.md)
     so the search input above them never scrolls out of view, and so
     windowed rendering above the size threshold has a fixed viewport to
     window against. Row height matches useVirtualList's itemHeight
     estimate (40px) so the estimated and real layout agree. */
  .openspec-changes-list-scroll,
  .openspec-archive-list-scroll {
    border: 1px solid var(--line);
    border-radius: 10px;
  }

  .openspec-changes-list li,
  .openspec-archive-list li {
    list-style: none;
    height: 40px;
    box-sizing: border-box;
  }

  .openspec-changes-list li button,
  .openspec-archive-list li button {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
  }

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
  .openspec-timeline-header dl {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 4px 0 0;
  }

  .openspec-timeline-header dt {
    color: var(--muted);
    font-size: 12px;
  }

  .openspec-timeline-header dd {
    margin: 0 16px 0 4px;
    font-size: 12px;
  }

  .openspec-timeline-artifact {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 12px 16px;
  }

  .openspec-timeline-tasks ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }

  .openspec-timeline-task-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--ink);
    padding: 6px 10px;
    cursor: pointer;
  }

  .openspec-timeline-task-marker {
    color: var(--primary);
    flex-shrink: 0;
  }

  .openspec-timeline-task-date {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .openspec-timeline-task-pending {
    font-style: italic;
  }

  .openspec-timeline-task-stale .openspec-timeline-task-toggle {
    border-color: var(--danger);
  }

  .openspec-timeline-task-stale .openspec-timeline-task-marker,
  .openspec-timeline-task-stale .openspec-timeline-task-date {
    color: var(--danger);
  }

  .openspec-timeline-task-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .openspec-timeline-task-detail {
    margin: 4px 0 0 10px;
    padding: 8px 10px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-size: 13px;
  }

  .openspec-multi-timeline-axis {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-size: 12px;
    margin-bottom: 8px;
  }

  .openspec-multi-timeline-lane {
    margin-bottom: 18px;
  }

  .openspec-multi-timeline-lane-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .openspec-multi-timeline-track {
    position: relative;
    height: 28px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: 8px;
  }

  .openspec-multi-timeline-point {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
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
    --u: 1rem;
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
       would silently break the moment anybody made the unit an em. */
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    /* Fixed size, so text beyond it is clipped rather than allowed to
       move the card's neighbours away from the coordinates core gave.
       The text stays in the DOM: a card must not be able to remove a
       fact the change is required to state. */
    overflow: hidden;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid var(--line-strong);
    border-left-width: 4px;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }

  .openspec-pipeline-node:hover { border-color: var(--primary-soft); }

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

  .openspec-pipeline-node-name {
    font-weight: 600;
    /* The part a reader scans for gets the room. It also never shrinks:
       its own overflow: hidden lets a fixed-height column squeeze it to
       nothing first, so a card with one line too many lost its name and
       kept its details. The card clips from the bottom instead. */
    flex-shrink: 0;
    align-self: stretch;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .openspec-pipeline-node-state {
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }

  .openspec-pipeline-node-detail {
    font-size: 0.85em;
    color: var(--muted);
    align-self: stretch;
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
  /* A div inherits the page's line height; a button, which is what a
     local card is, does not. Matched here so both fit the same height
     core gave. Line height only: a font-size of its own would move the
     card once the unit is an em (see .openspec-pipeline-node). */
  .openspec-pipeline-node--foreign { cursor: default; border-style: dashed; line-height: normal; }
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

  /* LAST in this layer on purpose. These selectors have the same
     specificity as the ones they override, and at equal specificity the
     later rule wins — placed earlier, the whole block did nothing.

     At phone width the two-column settings pane becomes one column and
     every control gives up its preferred width. Without it the page
     scrolled sideways by 274px at 400px wide, found by sweeping every
     tab after the restyle and never checked before. */
  @media (max-width: 720px) {
    .openspec-shell-grid,
    [data-testid="harness-settings-view"] .openspec-shell-field {
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

    /* Control widths are not colours and are not the editor's to
       decide, so they are the shell's values verbatim. */
    --w-amount: 6.5rem;
    --w-name: 14rem;
    --w-sentence: 26rem;
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

  .openspec-extension-app input,
  .openspec-extension-app textarea,
  .openspec-extension-app select {
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border-color: var(--vscode-input-border, var(--line));
  }

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

  .openspec-extension-app .openspec-ai-panel-controls button,
  .openspec-extension-app .openspec-editor-tabs button.is-active {
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
  }

  .openspec-extension-app .openspec-ai-panel-controls button:hover,
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
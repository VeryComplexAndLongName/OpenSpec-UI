The web UI's controls become Metro UI's, scoped and built from a pinned source.
In VS Code they take the editor theme's colours; the standalone shell gains a
dark theme that follows the system.

## 1. The decision

- [x] 1.1 `docs/adr/0030-the-web-ui-uses-metro-components.md`: Metro's
  components without tiles, vendored and scoped, and themed by each host. It
  supersedes 0023's Metro rejection and keeps 0023's other decisions.

  Done, and approved by the owner on 2026-09-15 with the proposal.
- [x] 1.2 `docs/adr/README.md` gains the row, and 0023's row says that 0030
  supersedes its Metro rejection.

## 2. Metro, vendored and derived

- [x] 2.1 `packages/webui/vendor/metro/`: `metro.css` and `LICENSE` from
  `@olton/metroui@5.1.20`, and a `README` naming the version and the
  SHA-256. Record the hash and where the file was taken from.

  Done on 2026-09-15.
  - **Source.** `npm pack @olton/metroui@5.1.20`: `lib/metro.css` and
    `LICENSE` (MIT) from that tarball, unchanged. The owner chose to keep
    this file in the repository rather than only the derived copy.
  - **The file.** `metro.css` is 1,481,825 bytes, SHA-256
    `50e237f90becdbae2f216e97d84c2d3e35ef2bde1bbd1b69d2b24ed9c762c1f1`. It
    has no non-ASCII byte.
  - **The project site's copy** differs by one byte: its last line ends in
    CRLF, from `core.autocrlf` on Windows. So the root `.gitattributes`
    marks the vendored file `-text`. Checked out on Windows, the file keeps
    the hash above.
- [x] 2.2 `packages/webui/scripts/build-metro.mjs`: the pass of design
  decision 2, with `css-tree` declared as a development dependency. It writes
  `src/metro-css.generated.ts`, and an npm script runs it.

  Done. `css-tree ^3.2.1` is a devDependency of `@openspec-ui/webui`, and
  `npm run build:metro -w @openspec-ui/webui` runs the script.
  - **A narrower rule than the design's first wording.** The first rule kept
    any rule whose selector named a kept component's class anywhere. That
    carried other components that merely contain a button or an input: a
    colour picker, a spinner, a tag input, a rating, sortable columns. It
    came to 1661 rules and 221,032 bytes.
  - **The rule now.** A selector is kept only when every class it names is a
    kept component's or one of `KEPT_MODIFIERS`: a colour for an action or
    state (`primary`, `alert`, `success`, `warning`, `info`), `small`, and the
    states a control passes through. Beside a kept class, any element may
    appear (`.table td`, `.button-group>*`).
  - **Native controls.** Metro's rules on `button`, `input`, `select`,
    `textarea` and `table` are kept too. Without `metro.js` they are how Metro
    draws a native control. Its `.input`, `.select` and `.textarea` classes
    style the wrappers its script builds, as `display:flex; padding:0`, so
    on a bare `<input>` they break the field. `html` and `body` are never
    kept.
  - **The layer.** The copy is wrapped in `@layer metro`. The shell's
    unlayered rules (widths, layout) then win over Metro's scoped selectors,
    with no specificity race.
  - **`!important`.** It is stripped from every kept declaration: 55 of
    them at first, and 25 once the colour modifiers left (2.4). Inside a
    layer an important declaration beats every unlayered one, and Metro
    writes literal colours that way.
  - **Where it is written down.** ADR 0030 decision 2 carries these three
    points as an amendment dated 2026-09-15. So do design decision 2 and the
    spec delta, with a scenario for a native field keeping the shell's
    width.
- [x] 2.3 Tests:
  - the vendored file's hash;
  - the generated module matches a fresh run of the script;
  - no rule on a bare element, `*`, `html` or `body` survives;
  - every selector starts with `.openspec-metro`;
  - no `url(` to another origin.

  Done: `packages/webui/scripts/build-metro.test.mjs` has 8 tests, run by the
  package's `vitest run`. They check:
  - the hash;
  - the fresh run;
  - one `@layer metro` at the top;
  - scoping;
  - no selector but a kept component's or a native control's;
  - no `html` or `body`, and no `*` outside a kept component;
  - no `!important`;
  - no external `url(` or `@import`.

  Notes:
  - **Environment.** They run in Vitest's node environment.
  - **The script's `#!` line went.** Vitest failed on it when importing the
    script, and the npm script runs the file through `node` anyway.
  - **A `*` inside a kept component stays.** Examples are `.button-group>*`,
    `.dialog *+.dialog-content` and `*+.card`. It reaches only that
    component's children.
- [x] 2.4 Record the derived copy's size, and each kept component's rule
  count.

  **Build of 2026-09-15**, after 3.2 trimmed the kept list to `button`,
  `input`, `select`, `textarea` and `table`:
  - **Size.** 112,595 bytes: 732 rules, 61 light and 42 dark variables, and
    no keyframes. 64 variables are read, 65 rules on bare elements were
    dropped, and 21 `!important` flags were stripped.
  - **Selectors per component:** button 606, input 291, table 53, select 45
    and textarea 36. On native fields, where no kept class is named: input
    252, textarea 19, select 16 and table 1.

  **The build before that trim**, with native controls, the layer, no
  `!important` and no colour modifiers:
  - **Size.** 142,982 bytes: 1,013 rules, 101 light and 72 dark variables,
    and no keyframes. 65 rules on bare elements were dropped, and 25
    `!important` flags stripped.
  - **Colour modifiers left the kept list.** `primary`, `alert`, `success`,
    `warning` and `info` are Metro's colour utilities, literal and
    `!important`: `.primary{background-color:#f75553!important;color:#fff!important}`.
    White on that red is 3.3:1, below AA, and `.button.primary:hover` would
    have turned a teal button red. The shell colours those classes from its
    tokens (design decision 4, and ADR 0030 decision 5 as amended).
  - **Earlier builds:**
    - with the colour modifiers: 147,634 bytes, 1,048 rules and 55
      `!important`;
    - with the narrower class rule alone: 132,319 bytes and 1,024 rules;
    - with the first, broad rule: 221,032 bytes and 1,661 rules.
  - **Selectors per component:** button 611, input 293, tabs 94, checkbox
    77, table 53, progress 52, select 45, badge 39, textarea 36, dialog 9,
    card 5 and panel 5.
  - **Selectors on native controls,** where no kept class is named: input
    252, textarea 19, select 16, button 10 and table 1. Most of the input
    count is the per-type lists `input[type=text],input[type=password],…`.
  - **Checks.** No selector falls outside `.openspec-metro`, and there is no
    `url(` and no `!important`.

  To be recorded again once 3.2 settles which modifiers the controls use.

## 3. The controls

- [x] 3.1 Each entry's root gains `openspec-metro` and injects the generated
  CSS before `shellThemeCss`.

  Done in the five entries: standalone, the AI panel, Harness Settings, the
  Pipeline and the Timeline.
  - **What changes on screen.** When 3.1 was first committed, nothing did:
    no `className` named a Metro class. Once 2.2 kept the native-control
    rules, every native button, field, select and textarea under the root
    takes Metro's look straight away. Wherever the shell's own unlayered
    rules set a property, theirs still wins.
  - **Checks.** webui typecheck and lint pass, and its tests pass: 52 files,
    477 tests.
  - **Line endings.** The root `.gitattributes` keeps
    `src/metro-css.generated.ts` in LF. A CRLF checkout would break the test
    that compares the module with a fresh run.
- [x] 3.2 Buttons, inputs, selects, textareas, checkboxes, tables, tabs,
  dialogs, progress and badges take Metro's classes. Record per component how
  many places changed.

  Done on 2026-09-15, with what the screens showed deciding three questions.
  - **Buttons: 50 places.**
    - `className="button"` on 36 actions: standalone-entry 17, PipelineView
      8, ProcessesView 4, AiPanel 3, RunDialog 2, EnrolmentRequests 1,
      TasksChecklist 1 and WorkspaceRunStatsPanel 1.
    - Also ChangesList's Refresh, and the header's theme toggle.
    - `primary` on the one main action of a form, 22 of them: Run, Start
      chain, Continue, Allow, Apply, both Save settings buttons, the
      configured path in the run dialog, Initialize, Load summary, Create
      change, Run with Agentic Harness, Save markdown, Load templates, Insert
      template, the three timeline loads, and Confirm enrolment.
    - `alert` on 6 that stop or discard: the two Cancels of a running chain
      or command, Ask to stop, Delete template, Clean old history and
      Rollback files.
    - The 36 were added by a one-off codemod with an explicit list of
      primary and alert actions, and every change was reviewed in its dry
      run.
  - **Buttons without a class.** List rows, tree nodes, links and tabs keep
    the shell's styling: ChangesList and ArchiveList rows, SpecsTree,
    SpecsSearch, RequirementView, ChangeRelations, the timeline toggle, and
    the page, editor and timeline-mode tabs. So does a Pipeline card's own
    controls, which keeps the card's measured geometry (3.4).
  - **Why `button` is a class, not the bare element.** The first build kept
    Metro's bare `button` rule. The retaken pictures then showed a changes
    row as a grey 36px button, so the rule left the build.
  - **Fields: no class.** Inputs, selects and textareas take Metro's look
    from its native-field rules (2.2). Metro lists no `type=number`, so the
    shell draws that one from Metro's own input variables. A control's text
    follows its surroundings (`--input-font-size: 1em`), so a placeholder
    is no longer 16px beside a 12px value.
  - **Tables: 4 places.** `table` goes on the two overview tables in
    standalone-entry, on ProcessesView's and on ChangeChartsView's.
  - **Not applicable, and dropped from the kept list.**
    - `checkbox`, `tabs` and `progress` style the elements `metro.js` builds
      around a native control. React renders none of them. The one native
      checkbox takes Metro's look from the `input` rules.
    - `dialog` is a fixed-position modal, and the run dialog and the stop
      form sit in the page.
    - No screen uses `badge`, `panel` or `card`.
    - The copy fell to 732 rules and 112,595 bytes, and reads 64 variables
      instead of 104.
  - **Action colours are the shell's.** In `shellThemeCss`,
    `.openspec-metro .button.primary` and `.button.alert` take `--primary`
    and `--danger`, with a focus ring drawn against the fill. The old rule
    that painted every AI panel button with the accent is gone. In
    `vscodeThemeCss`, the editor's button colours now go to `.button.primary`
    only.
- [x] 3.3 Remove each `openspec-*` rule that a Metro rule now does, rather
  than overriding it. Record which rules went.

  Done on 2026-09-15. These rules went.
  - **The shared field block** (`.openspec-shell-field input/textarea/select`,
    `.openspec-ai-panel-controls select/button`): `border`, `border-radius`,
    `padding`, `color` and `background` went. Metro's native-field and
    `.button` rules draw those. `font: inherit`, `font-weight` and
    `letter-spacing` stay, so a control reads in the form's own text size.
  - **The accent on every AI panel button.** `.openspec-ai-panel-controls
    button` and its hover, focus and disabled rules went. The old block also
    held a `[data-testid="cancel-button"]` danger rule that matched no
    element: the button's id is `cancel-run-button`. Colour now comes from
    `.button.primary` and `.button.alert` on the shell's tokens, and Metro
    draws the disabled state.
  - **The VS Code field colours.** `.openspec-extension-app input, textarea,
    select` set `color`, `background` and `border-color` from
    `--vscode-input-*`. The Metro mapping sets `--input-*` from the same
    colours, so that rule went. The placeholder rule stays, since Metro
    colours no placeholder.

  These stay, because Metro does not do them:
  - control widths by kind of value (ADR 0023);
  - the focus-visible outlines, which are stronger than Metro's 3px grey
    shadow;
  - the page and editor tabs, list rows and the Pipeline card's controls;
  - `input[type=number]`, which Metro does not list.
- [x] 3.4 Layout, the Pipeline picture, the dense forms' two-column rows and
  prose widths are unchanged. The unit tests that assert them still pass.

  Done on 2026-09-15.
  - **Widths.** The width rules sit in the shell's unlayered layer, above
    `@layer metro`: control widths by kind of value, a select sized by its
    options, the two-column settings rows, and the phone-width collapse.
    `shell-ui.test.ts` asserts them ("gives a control a width for the kind
    of value it holds", "lets a select size itself…"), and it passes.
  - **The Pipeline.** Its card controls take no Metro class, so the cards
    keep their measured geometry. The browser suite's geometry specs pass:
    "opens a card to its tasks, and cuts no line at any zoom" and "becomes
    headed lanes at phone width, with no lines". The retaken `pipeline.png`
    shows the cards as before, with Metro buttons only on the toolbar and
    on Refresh.
  - **The forms.** Harness Settings, the run dialog and the Change Editor
    keep their two-column rows and prose widths in the retaken pictures.
    Controls are 36px tall instead of about 30px, which is Metro's control
    height and the one visible change.

## 4. Themes

- [x] 4.1 Standalone: the toggle in the header and the theme choice of
  design decision 5, with unit tests for no stored choice, a stored choice,
  a system change and unreadable storage.

  Done on 2026-09-15.
  - **`src/standalone-theme.ts`.** `useStandaloneTheme` resolves a stored
    `light` or `dark` under `openspec-ui.theme` first, then
    `(prefers-color-scheme: dark)`. It follows a change to that query while
    no choice is stored. It sets `data-openspec-theme` on the document
    element, and its storage and `matchMedia` calls are wrapped so that
    none of them throws.
  - **`components/ThemeToggle.tsx`.** A `button` named "Dark theme" with
    `aria-pressed`, so the visible text and the accessible name agree. It
    sits at the end of the standalone headline, and the root gains Metro's
    `dark-side` when the theme is dark.
  - **The shell's own dark palette.** `:root[data-openspec-theme="dark"]` in
    `shellThemeCss` redefines every colour token. It keys on the document
    element because `body` draws its ground from those tokens.
    - `shell-ui.test.ts` cuts that block out of the no-literal check, as a
      palette.
    - A new test asserts that the dark palette carries every colour token of
      the light one, and no token the light one lacks.
    - Contrast is checked by axe in 5.1.
  - **Tests.** `standalone-theme.test.tsx` has 5 tests: no stored choice on
    a dark system; a stored choice over the system; a system change followed
    until a choice is made; storage that throws on read and write, where the
    toggle still works for the page; and reaching storage itself throwing.
  - **Checks.** The webui suite passes with 53 files and 486 tests, and
    typecheck and lint pass.
- [x] 4.2 VS Code: `vscodeThemeCss` sets every variable the generated copy
  reads, and `dark-side` follows `vscode-dark` and `vscode-high-contrast`. A
  test asserts every read variable is set.

  Done on 2026-09-15.
  - **The mapping.** `vscodeThemeCss` gains an unlayered `.openspec-metro`
    block that sets each of the 64 variables the trimmed copy reads from its
    palette.
    - Colours come from `--vscode-*` only: button and secondary button,
      input, dropdown, checkbox, focus border, disabled foreground, list
      selection, editor widget, panel and contrast borders, input
      validation, and testing and charts for valid.
    - Sizes follow the editor's density: controls 28px, small 22px, radii
      2px, font sizes the editor's.
    - Metro's 3px focus shadow is transparent, and the shell's focus
      outline carries focus.
  - **Alert.** `.button.alert` takes `--vscode-inputValidation-errorBorder`
    behind the button foreground. `--vscode-errorForeground` is a text
    colour, too light to sit under text.
  - **`dark-side`.** `src/vscode-theme.ts` has `useEditorDarkTheme()`, which
    watches the webview body's class through a `MutationObserver`.
    `vscode-dark` and `vscode-high-contrast` count as dark, and
    `vscode-high-contrast-light` never does. `metroRootClassName` puts
    `dark-side` on the root of the AI panel, Harness Settings, the Pipeline
    and the Timeline. Every variable is set by the mapping, so the dark
    palette only decides what an unset variable would fall back to.
  - **Tests.**
    - `vscode-metro-mapping.test.ts` collects every `var()` the copy reads
      from its palette, leaving out variables a component rule declares
      for itself such as `--control-height`. It asserts that the VS Code
      layer sets each one, and that the layer holds no hex or `rgb()`
      colour.
    - `vscode-theme.test.tsx` covers the four body classes, the root class,
      and a theme switched while the webview is open.
  - **Checks.** The webui suite passes with 55 files and 491 tests, and
    typecheck, lint and `lint:test-budgets` pass.
- [x] 4.3 Live check in the Extension Development Host, with pictures, in
  Default Dark Modern, Default Light Modern, Default High Contrast and one
  third-party theme: the AI panel, Harness Settings, the Pipeline and the
  Timeline. Record that each control's colours come from that theme.

  Done on 2026-09-15, with VS Code 1.137.0 from `.vscode-test`.
  - **How.** A one-off Playwright `_electron` spec, not committed, launched
    the Extension Development Host once per theme, set through
    `workbench.colorTheme`. Each run opened the four panels by their
    commands: Open Process Dashboard, Configure Harness Settings, Open
    Pipeline, and Show Change Comparison Timeline, answering its picker.
    In each webview it read the body class, the root class, the theme's
    `--vscode-*` values, and the colours actually drawn on a primary
    button, a neutral button and a field. 16 of 16 passed; the pictures
    were kept outside the repository.
  - **The fourth theme is Monokai,** a community theme that ships inside
    VS Code. No Marketplace colour theme is installed on this machine, and
    the run's extensions directory is empty.
  - **What each theme drew:**

    | Theme | Root | Primary button | Neutral button | Field |
    | --- | --- | --- | --- | --- |
    | Default Dark Modern | `dark-side` | `#0078d4` on white | transparent, `#cccccc` text | `#313131`, border `#3c3c3c` |
    | Default Light Modern | light | `#005fb8` on white | `#e5e5e5`, `#3b3b3b` text | white, border `#cecece` |
    | Default High Contrast | `dark-side` | black on white, contrast border | black, contrast border | black, border `#6fc3df` |
    | Monokai | `dark-side` | `#75715e` on white | `#3e3d32`, `#cccccc` text | `#414339` |

    Every value is that theme's own `--vscode-button-*` or
    `--vscode-input-*`, and none is Metro's.
  - **Found and fixed on the way.**
    - **Default Dark Modern.** Its secondary button ground is transparent,
      so "Reload changes", "Open all" and "Refresh" read as text. A neutral
      button now takes the theme's button border.
    - **Default High Contrast.** "Apply" read as text, because the shell's
      transparent border on a primary button won over that rule. Every
      button, primary and alert included, now takes
      `--vscode-contrastBorder` first. The rerun's pictures show the border
      in both themes.
  - **Left as it was.** The Pipeline card's own Start and Show tasks
    buttons keep the shell's styling (3.4).

## 5. Pictures and checks

- [x] 5.1 The whole standalone browser suite passes. axe's WCAG AA run covers
  the standalone shell in light and in dark.

  Done on 2026-09-15.
  - **The whole suite.** `npm run test:browser -w @openspec-ui/server`, run
    unpiped: 20 passed in 7.2 minutes.
  - **The dark pass.** `standalone.spec.ts` now presses the header's "Dark
    theme" toggle after its light axe run. It checks `aria-pressed` and
    `data-openspec-theme="dark"`, then runs axe again with the same WCAG
    2.0 and 2.1 A/AA tags, with no serious or critical violation allowed.
  - **A second run.** That spec, with the disabled-state fix below, was
    rebuilt and run on its own: 1 passed in 15.2s. The whole-suite run
    had compiled the spec before the dark pass was added.
  - **A fix found while looking at the dark screen.** Metro's dark palette
    draws a disabled button at 25% opacity, and a disabled field as
    near-black text on near-black. Both all but vanished. `shellThemeCss`
    now sets `--button-disabled-opacity`, `--input-color-disabled` and
    `--input-background-disabled` from the shell's tokens, and the VS Code
    layer sets them from the editor theme.
- [ ] 5.2 Every picture under `docs/images/` is retaken by its spec, from Bash
  for the editor pictures, and looked at.
- [x] 5.3 A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` minor,
  `@openspec-ui/server` patch.

  Done: `.changeset/the-web-ui-wears-metro.md`, with those three levels.
  Its summary is written for the Marketplace changelog: Metro controls from
  a vendored copy, primary and alert actions, the standalone dark theme and
  its toggle, and the editor theme's colours in VS Code.
  `lint:changesets` passes.
- [ ] 5.4 `openspec validate the-web-ui-wears-metro --strict`, `lint:english`
  after `git add`, and `lint:screenshots` pass.
- [ ] 5.5 `npm run verify` passes, run unpiped. Record each package's count.
- [x] 5.6 Live check of the standalone server in both themes, with a
  picture of the toggle.

  Done on 2026-09-15, against `npm run start -w @openspec-ui/server --
  C:\Prog\OpenSpec-UI 4917` in Chromium, with pictures kept outside the
  repository.
  - **A light system.** The shell opens light, and the toggle reads "Dark
    theme" with `aria-pressed="false"`. On the Run a Command screen the
    neutral Metro buttons are grey, Run is the accent and Cancel the danger
    colour.
  - **The toggle, pressed.** The shell turns dark, and after a reload
    `data-openspec-theme` is still `dark`: the choice was remembered.
  - **A dark system with no stored choice.** The shell opens dark in
    379 ms, with the toggle pressed. After the disabled-state fix of 5.1,
    disabled selects read in the muted colour, and the enabled Run and
    Cancel keep their colours.
  - **Two failed captures were the script's.** Its reload started a `list`
    run, and the next browser context waited behind it. A fresh
    dark-scheme context loads normally, and the server logged no error.
  - **Found by looking.** Tables drew their cells at Metro's 16px beside
    13px prose, on Processes and the change charts. `shellThemeCss` now
    sets the three table font-size variables to `1em`.

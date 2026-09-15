# 0030: The Web UI Uses Metro UI's Components, Scoped and Themed by Its Host

Status: Accepted

Date: 2026-09-15

Supersedes the "Metro 5" rejection in
[0023](0023-standalone-shell-visual-direction.md). Its other decisions stand.

## Context

ADR 0023 drew four directions for the standalone shell on the real Harness
Settings screen, and rejected Metro 5: "tiles are a launcher's language, not a
form's". It kept what it found good in Metro — no card, no shadow, colour used
sparingly, labels small and bold — inside an editor-native look of its own.

The owner has since moved the project site to Metro UI 5.1
(`OpenSpec-UI-Homepage`, `2026-09-14-metro-redesign`), and asked for the web UI
to use the same framework. On 2026-09-15 they chose, of the two readings:

- **Metro's components, without its tiles.** Buttons, inputs, selects, tables,
  tabs, dialogs, badges and the palette come from Metro. The screens keep their
  own layout, and dense forms stay forms. That answers 0023's objection, which
  was to tiles in a form, not to Metro's controls.
- **A dark theme in the standalone shell** that follows the operating system,
  with a toggle that remembers the choice. Inside VS Code the colours are the
  editor theme's.

Measured on Metro UI 5.1.20, the latest release:

| | |
| --- | --- |
| `metro.css` | 1,481,826 bytes |
| Theme variables | 1,104 light, in 142 `:root` blocks; 626 dark, in 112 `.dark-side` blocks |
| Rules on bare elements | about 434, including `*{margin:0;padding:0}` and `body{display:flex;flex-direction:column;min-height:100vh}` |
| Variables of the components the web UI would use | about 200 light |

The web UI is carried by five bundles: the standalone shell, and four VS Code
webviews (the AI panel, Harness Settings, the Pipeline and the Timeline). Its
styles are TypeScript strings today, 287 rule blocks over 194 `openspec-*`
classes, with every colour a named token (0023 decision 3) and a second layer
that maps each token to `--vscode-*` (0023 decision 4).

## Decision

1. **Metro UI 5.1.20 is vendored as its source, pinned, with its MIT licence.**
   Nothing is fetched from another origin at build time or at run time. A
   webview's Content Security Policy would refuse it, and the project site made
   the same call.

2. **What ships is a derived copy, built from the vendored source.**
   - **What the build step keeps.** Only the rules of the components the web
     UI uses, and Metro's rules on the native controls those components are
     drawn with: `button`, `input`, `select`, `textarea` and `table`.
   - **What it drops.** Every other rule on a bare element: `*`, `html`,
     `body`, `img`, headings and the rest.
   - **Scope.** Every selector sits under one root class.
   - **Layer.** The copy sits in a cascade layer, so the shell's own layout
     and width rules win wherever both set a property.

   The result is one CSS string the five bundles already know how to carry.
   Metro's global rules would otherwise restyle every webview page: the
   project site found its `body` rule shrinking the header and footer to their
   content.

   *Amended on 2026-09-15, during implementation.* The first wording dropped
   every rule on a bare element, native controls included. Without
   `metro.js`, though, those rules are how Metro draws a native control. Its
   `.input`, `.select` and `.textarea` classes style the wrappers its script
   builds, as a flex box with no padding. Scoped under the root, a
   native-control rule reaches no page Metro does not own, so the decision's
   reason still holds.

   The same amendment added two more things:
   - **The cascade layer.** Without it, Metro's scoped selectors outweigh the
     shell's widths from 0023.
   - **Stripping `!important`** from the copy. Inside a layer, an important
     declaration beats every unlayered one. Metro's primary and alert hover
     colours are written that way, so they would override the editor theme's.

3. **No `metro.js`.** React owns the DOM and every behaviour. Metro's script
   builds and moves elements itself, which React would fight.

4. **Metro's components, not its layout language.** No tiles, app bar or side
   navigation in place of the tabs. A screen's arrangement, and 0023's
   two-column name-and-value rows, stay.

5. **Colours stay tokens, and each host sets them.**
   - **The standalone shell** uses Metro's light palette, and its `.dark-side`
     palette when the dark theme is on. That is the operating system's
     preference, or the header toggle's remembered choice.
   - **In VS Code**, a mapping layer sets Metro's variables for every
     component used from `--vscode-*`: the editor background, buttons, inputs,
     focus border, badges, and `--vscode-charts-*` for states. No literal
     colour is written for the editor.
   - **Dark and high contrast in VS Code** follow the class the editor puts on
     the page (`vscode-dark`, `vscode-high-contrast`), so any theme a person
     has chosen, built-in or not, is the one the panels wear.

6. **0023's gates carry over to the new variables.**
   - **Both layers carry the same names.** A test asserts that every Metro
     variable the derived copy reads is set by the VS Code layer too.
   - **Contrast is a gate.** axe's WCAG AA run covers both themes of the
     standalone shell.

## Rejected Alternatives

### Vendoring `metro.css` whole

About 1.5 MB in each of five bundles, and hundreds of rules on bare elements
restyling pages Metro does not own. The project site vendored it whole because
it serves one set of pages it controls end to end. The web UI runs inside
another product's windows.

### Scoping by rebuilding Metro from its LESS sources

The project site rejected scoping for this reason: a rebuild on every upgrade.
A selector pass over the compiled, pinned CSS reaches the same result without
Metro's toolchain.

### Tiles and Metro's layout, as on the project site

The owner chose components only. Tiles over Harness Settings decorate the
header and then an ordinary form begins, which is 0023's finding and still
true.

### Dimming Metro's colours inside VS Code

A filter or a fixed muted palette is still this product's palette, painted
over somebody's editor. Mapping to the theme's own variables is what makes the
panel look like it belongs in whatever theme is chosen.

## Consequences

- **An upgrade of Metro** is a new pinned source and a rebuild of the derived
  copy. The tests then say which component variable lost its VS Code mapping.
- **Two tokens layers become three.** Metro's variables, this product's
  tokens, and the VS Code mapping. Each token still has one name and one
  purpose.
- **Every picture under `docs/images/` changes** in the change that applies
  this. The pictures are captured by specs, so they are retaken, not edited.
- **The standalone shell gains a dark theme**, and with it a second set of
  contrast checks.

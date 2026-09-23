Asked by the owner on 2026-09-23: separate the stages with a vertical
rule, and give each heading a picture and a colour, light theme and dark
alike. The counters he had queued go in the same headings.

## 1. What a stage looks like

- [x] 1.1 The picture and the colour token of each stage named in core,
  once. A meaning, never a glyph: which glyph draws a meaning belongs to
  the surface that draws it.
- [x] 1.2 The board's layout carries the look of each column beside its
  word; the arrangement by declared order carries none.

## 2. The palette

- [x] 2.1 Six tokens, one per stage, in the light palette, the dark
  palette and the editor's layer.
- [x] 2.2 In the editor they come from the editor's own chart colours.
  Proposed and Archived are named apart there: following the shell's
  aliases would give both the description foreground.

## 3. The board

- [x] 3.1 A rule between each column and the next, never before the first,
  and only on the board.
- [x] 3.2 Each heading: the word, the picture, the count, the colour.
- [x] 3.3 The count said for a reader who hears the heading, and shown as
  a figure for one who scans it.

## 4. Checks

- [x] 4.1 Tests: the heading's picture, token and counts; the rules and
  their absence in the other arrangement; the stylesheet's token parity.
- [x] 4.2 Live, 2026-09-23: the standalone on a workspace of two changes,
  in both themes. Light and dark both draw six headed columns with their
  own colours, five rules, and the counts 0, 1, 1, 0, 0, 0.
- [x] 4.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1883 and 57,
  extension 493, server 116, webui 659.
- [x] 4.4 The extension's integration suite: 19 passing. The whole
  standalone browser suite: 29 of 29 in 7.7 minutes. Its accessibility
  check refused the first attempt, which wrote the headings in the stage
  colours: teal on white is 2.09:1 and amber 1.53:1 against 4.5:1. The
  colour became the ground the picture stands on, with its measured ink,
  and the words kept the colour every heading has.
- [x] 4.5 `openspec validate the-board-wears-its-stages --strict`: valid.
  The merge gate locally with `--base origin/main`: ok.
- [x] 4.6 A changeset: core and webui, patch.

## Why

Asked by the owner on 2026-09-23, once the board finally appeared: can
each stage be separated by a vertical rule, and can each heading carry a
colour - or better, a picture coloured with it, with the light and dark
themes provided for?

Both, and the second as he put it. A colour alone is a distinction a
reader of a high-contrast theme never gets, and this repository already
says so of another case: colour may agree with words and must not replace
them. A picture plus the word plus the colour satisfies that literally.

And while the headings are being rewritten, the counters he asked for
belong in them: with every column now always drawn, a figure in the
heading is what says where the work has piled up.

## What Changes

- A rule between each column of the board and the next, never before the
  first. Only on the board: the other arrangement's columns are a
  sequence, and a rule there would assert a boundary nothing has.
- Each heading carries the stage's word, a picture that stands for that
  stage, the number of changes in the column, and a colour of that
  stage's own. The count is said for a reader who hears the heading and
  shown as a figure for one who scans it.
- Six colour tokens, one per stage, defined in the light palette, the
  dark palette and the editor's layer. In the editor they come from the
  editor's own chart colours: repainting somebody's editor would override
  a choice that is theirs (ADR 0023 decision 4). The stylesheet's own test
  already fails when a token exists in one layer and not another.
- Which picture and which token belong to a stage are named in core, once,
  so the editor and the standalone cannot come to disagree about what
  Planned looks like. Core names a meaning, never a glyph.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - what the board's columns and their headings carry.

## Impact

- `packages/core/src/change-history-facts.ts`, `change-layout.ts`.
- `packages/webui/src/shell-ui.ts`,
  `packages/webui/src/components/PipelineView.tsx`, and their tests.
- One requirement in `openspec/specs/shared-ui/spec.md`.

## Explicitly out of scope

- **New glyphs.** The six pictures are meanings this product already
  names, so the icon font is untouched: adding a glyph means regenerating
  the subset, and the vocabulary already had one for each stage.
- **Colouring the cards.** A card already says its stage in words. Tinting
  it too would repeat the column it stands in, and on a board that is
  noise rather than information.

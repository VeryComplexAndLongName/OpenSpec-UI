## Why

The owner asked on 2026-09-19: leave a change's text in the theme's own
colour and colour only its icon.

Today the whole row is tinted. `ChangeStandingDecorations` returns a file
decoration whose `color` VS Code applies to the item's **label**, so a list
of changes is a list of coloured words: green, yellow, blue, red, grey, one
after another. The colour was meant to be a signal beside the word; at a
dozen rows it reads as the subject.

The reason the colour went on the label rather than the icon is written in
that file: an icon tint alone is lost in several themes and says nothing to
a screen reader. That reason still holds, and it is answered by what the row
already carries rather than by tinting the words: the standing's word is in
the description, the one-letter badge is in the decoration, and the word is
the tooltip. None of those go.

## What Changes

- The change's **icon** carries the standing's colour, as a
  `ThemeIcon` with a `ThemeColor`.
- The file decoration keeps the badge and the tooltip and no longer carries
  a colour, so the label is drawn in the theme's ordinary foreground.
- Nothing else moves: the word in the description, the badge letter, the
  tooltip and the redraw rule are what they were.

## Capabilities

### Modified Capabilities

- `vscode-extension`: the Changes tree's standing says where the colour is.

## Impact

- `packages/extension/src/tree/change-standing-decorations.ts` and
  `packages/extension/src/tree/changes-tree.ts`, and their tests.
- `packages/extension/e2e/editor-screenshots.spec.ts` retakes the pictures
  that show the tree.
- A changeset for `openspec-ui-vscode`.

## Explicitly out of scope

- The Change Graph tree, whose icons say what a node is - a cycle, a wait,
  an archive - and carry no standing colour to move.
- The standalone app, where a card's colour is drawn by the shell's own
  tokens and was never a label tint.
- Changing which colour means what. `ChangeStateColour` in core decides
  that, and it does not change here.

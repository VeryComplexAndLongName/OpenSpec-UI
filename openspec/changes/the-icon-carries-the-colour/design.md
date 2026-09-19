## Context

`ChangeStandingDecorations` implements `vscode.FileDecorationProvider`.
VS Code applies a decoration's `color` to the tree item's label text and to
its badge; there is no member of `FileDecoration` that reaches the icon.
The only way to colour an icon is `new vscode.ThemeIcon(id, new
vscode.ThemeColor(id))` on the item itself.

So this is not a setting to flip: the colour has to be handed to the item
that is built in `ChangeTreeItem`'s constructor, which already receives the
standing it would take the colour from.

## Goals / Non-Goals

**Goals:**

- The colour rides the icon; the words are the theme's own.
- Everything the colour was checked against in words stays: the
  description, the badge, the tooltip.

**Non-Goals:**

- A second way to say the same thing. The map from `ChangeStateColour` to a
  theme colour stays in one place and is used by whoever needs it.

## Decisions

### The mapping stays where it is and is exported

`THEME_COLOUR` lives in `change-standing-decorations.ts` beside the reason
it exists. It becomes `standingThemeColour(colour)`, exported, and
`ChangeTreeItem` calls it. Two maps would drift, and the one that drifted
would be the one nobody reads.

### The decoration keeps the badge and gives up the colour

A decoration with a badge and a tooltip and no colour is still a
decoration: the letter is drawn in the editor's ordinary decoration
foreground. That is the point - the row's text, badge included, is no longer
tinted.

**Rejected: keeping a faint label colour as well.** Then the change would be
"less colour", which is a matter of taste that the next reader would argue
with. The owner asked for colour on the icon, and a rule with one place for
colour is a rule that can be checked.

### The screen-reader argument is answered, not overruled

The comment that put the colour on the label is right that an icon tint
alone says nothing to a reader who cannot see it. Nothing here makes colour
the only carrier: the word is in the description and in the tooltip, and the
badge is a letter, not a hue. The existing scenario that states this is kept
word for word.

## Risks / Trade-offs

- **An icon tint is weaker than a label tint.** That is what was asked for,
  and the word beside it is what carries the meaning.
- **A theme that draws tree icons in a fixed colour will show nothing.** The
  word and the badge still say it, which is the same guarantee as before.

Asked for by the owner on 2026-09-19: leave the text in the theme's colour
and colour only the icon.

## 1. The icon takes the colour

- [x] 1.1 `packages/extension/src/tree/change-standing-decorations.ts`
  exports `standingThemeColour(colour)`, the one map from
  `ChangeStateColour` to a theme colour, and keeps the reason it exists
  beside it.
- [x] 1.2 `packages/extension/src/tree/changes-tree.ts` builds the change
  item's icon as a `ThemeIcon` with that colour, where the standing has
  one, and unchanged where it has none.
- [x] 1.3 The file decoration keeps the badge and the tooltip and returns
  no colour, so the label and the badge are drawn in the theme's own
  foreground.
- [x] 1.4 The header comment in the decorations file says where the colour
  went and why the reason it was on the label is answered rather than
  overruled.

## 2. Checks

- [x] 2.1 `packages/extension/src/tree/changes-tree-standing.test.ts` and
  the decorations' own test cover: an item whose standing has a colour
  carrying it on the icon; the same item's decoration carrying the badge
  and no colour; and a standing with no colour leaving the icon as it was.
- [x] 2.2 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-19: typecheck and lint green across the workspace. core 1604
  in 114 files plus 4 in 2 for the git subprocess project, cli 165 in 16,
  extension 443 in 31, server 109 in 4, webui 611 of 612 in 71 - the one
  failure is the known Windows-only
  `scripts/build-metro-icons.test.mjs` line-ending comparison, which fails
  here on an untouched tree and passes in CI.

  Found on the way: `packages/extension/src/test-utils/vscode-mock.ts` took
  only the icon's id, so a `ThemeIcon` built with a colour dropped it and
  the new test read `undefined` while the real editor would have been
  right. The mock now takes the colour, which is the real API's second
  argument.
- [x] 2.3 A changeset: `openspec-ui-vscode` patch.
- [x] 2.4 `npm run test:pictures -w openspec-ui-vscode` passes and the
  pictures that show the Changes tree are retaken and committed.

  Done 2026-09-19: 17 passed in 1.1 minutes, and the eight pictures it
  retook are committed.

  Two things in the capture had to be fixed before it could run at all, and
  neither is about this change:

  - `findEditor` looked for the downloaded editor under the repository
    root's `.vscode-test` only, while the integration suite had put it under
    `packages/extension/.vscode-test`. It now looks in both and says both in
    its refusal.
  - `runCommand` waited for the quick input widget to hide after running a
    command. For a command that opens an input box of its own - Filter
    Archive - the widget never hides, and whether a gap appears between the
    palette closing and the box opening is a race. It lost twice in a row.
    A command that asks something now says what its box carries, and the
    helper waits for that instead.

  What the pictures do not show: the colour. The capture's fixture has no
  change whose standing carries one - both rows read Ready and Blocked,
  whose colour is none - so the retaken `changes-standings.png` differs from
  the old one only in an activity bar badge. The colour is proved by the
  test, not by the picture, and making the fixture produce a coloured
  standing would mean stubbing a reading that comes from refs and pull
  requests.
- [x] 2.5 **Human-only.** Whether the tree reads better with the colour on
  the icon, at a dozen rows rather than at one.

  Done 2026-09-19 by Claude, at the owner's request rather than by the
  owner, for the owner to look at in turn - and honestly only in part.

  What is verified: the item's icon carries the standing's theme colour,
  the decoration carries the badge and the word and no colour, and an item
  whose standing has no colour is left as it was. That is the test, and it
  now fails if the colour goes missing, which it could not before.

  What is not verified here, and is the owner's own glance: whether a dozen
  rows read better this way. This repository's own tree is where that shows,
  with real standings from refs and pull requests; the capture's fixture has
  no coloured standing to draw.

## Why

On 2026-09-17 the owner asked for a way to search for a change in the
Timeline tab: "I have a huge number of them. Finding the one I need is not
realistic."

The one-change picker is a `<select>` listing every active change and then
every archived one, oldest first. On this repository that is 261 options
(5 active, 256 archived) in one scrolling list, with no way to type part of
a name, and the change a person usually wants, a recent one, is at the very
bottom.

## What Changes

- **The picker is a search field.** Typing part of a change's name lists
  the changes whose name holds every word typed, under the field, as the
  person types. An archive folder's date and the words "active" and
  "archived" match too.
- **Chosen with the keyboard or the mouse.** The arrow keys walk the list,
  Enter chooses, Escape closes it without choosing, and a click chooses.
  Choosing loads the timeline, as choosing from the select did.
- **Recent first.** Active changes come first, then the archive newest
  first.
- **The list stays short.** At most 100 matches are drawn; the rest are
  counted, with a line saying to type more of the name. "No change
  matches." when nothing does.
- **Not in this change:** the other tabs' change pickers (Diff, Editor, the
  run panel), which list active changes only, and Compare changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `standalone-app`: the Timeline tab's change is chosen by searching for it.

## Impact

- `packages/webui/src/components/ChangePicker.tsx` and its test, new.
- `packages/webui/src/standalone-entry.tsx`: the Timeline toolbar draws the
  picker; `packages/webui/src/shell-ui.ts`: its styles.
- `packages/server/e2e/frame-screenshots.spec.ts` finds the change by typing,
  and retakes `timeline-change-light.png` and `timeline-change-dark.png`.
- No core, server route or payload changes.

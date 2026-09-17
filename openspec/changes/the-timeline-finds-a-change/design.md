## Context

The Timeline tab's one-change toolbar draws a native `<select>` of every
active and archived change (`packages/webui/src/standalone-entry.tsx`).
Choosing an option loads that change's timeline and puts the one shown away
at once. The shell already has `SearchField`, a plain search input with a
magnifier, used to filter lists that are drawn anyway.

## Goals / Non-Goals

**Goals:**

- A change among hundreds is found by typing a few letters of its name.
- Keyboard and screen reader use as good as the select's.
- Choosing behaves exactly as before: load at once, the old view gone.

**Non-Goals:**

- A search over anything but the name, such as proposal text.
- The other pickers in the shell, which list active changes only.

## Decisions

### A combobox, not a filter beside the select

A search field that filters the select would keep two controls and two
steps: type, then open the select and pick. A combobox is one control: the
input shows the chosen change, and on focus becomes the query with its
matches under it. It follows the ARIA combobox pattern: `role="combobox"`
with `aria-expanded`, `aria-controls` and `aria-activedescendant`, a
`listbox` of `option`s, arrow keys, Enter and Escape.

An option is chosen on `mousedown`, with the default prevented, so the input
keeps focus and the list is still there when the choice lands; on `click`
the input's blur would close the list first.

### Every word, anywhere in the name

The query is split into words, and an option matches when each word appears
in its name, its archive folder (for the date), or the word "active" or
"archived". Case does not matter. Order is kept, so no ranking can move a
change the person has learnt the place of.

### A bounded list

At most `CHANGE_PICKER_SHOWN` (100) matches are drawn, with a count of the
rest and a line asking for more of the name. The count is `aria-live`, so a
screen reader hears how many match as the person types.

## Risks / Trade-offs

- **A native select's platform behaviours** (type-ahead on the first letter,
  the mobile picker) are gone. Typing any part of the name replaces the
  first; on a phone the list is drawn under the field.
- **The field shows the chosen change's name** until it takes focus, then
  is empty for the query. Escape or leaving the field shows the chosen name
  again.

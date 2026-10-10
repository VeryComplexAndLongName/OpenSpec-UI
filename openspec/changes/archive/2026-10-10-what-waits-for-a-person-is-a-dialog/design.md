## Context

ADR 0047 sets the rule. The forms it names already existed, each with its
own role and name; what was missing was the layer that makes them modal,
and a place at the top that says what waits.

## Decisions

1. **A layer around the dialog, not a second dialog.** `ModalLayer` draws
   the backdrop, moves and keeps the focus, and answers Escape; the dialog
   inside keeps its role, its name and its test id, and gains `aria-modal`.
   Every test and every end-to-end spec that finds a form by its role and
   name finds it as before.
2. **No portal.** The layer is fixed to the viewport where it is drawn. The
   theme's tokens are set on the app's own root element, so a dialog moved
   to `document.body` would lose them; nothing between the layer and the
   root transforms it.
3. **Escape is the dialog's own Cancel.** A press on the backdrop does
   nothing: a dialog closed by a stray press loses what was typed.
4. **The banner announces; it does not open.** A question that arrives
   while the person types elsewhere would take the keyboard mid-word. The
   banner's Answer opens the card's own dialog, and its Allow and Deny send
   the card's own control. It reads the cards the view already has: no new
   reading.
5. **A run's panel holds its prompts at its top.** The run panel and the
   chain panel are the run itself, and the chain panel is itself drawn in
   the standalone app's dialog, so a second dialog there would stand on a
   dialog. What the run waits for stands first in the panel, sticky, with
   its controls in it.

## Risks / Trade-offs

- **A modal dialog hides the picture it is about.** Its title names the
  change, so what it is about is not lost with the card.
- **Captured screenshots change.** The Pipeline's top now carries the
  banner where an agent asks; the end-to-end captures follow.

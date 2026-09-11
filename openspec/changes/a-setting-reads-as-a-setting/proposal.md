# A setting reads as a setting

## Why

Reported on 2026-09-10, translated because every file here is English:
"Parameter names need to be told apart from parameter values visually.
Also, in the standalone UI many buttons are stuck to the input fields.
And in the dropdowns the arrow sits almost at the right edge of the
field. In short: the design is not great."

All three are real, and none of them is a matter of taste.

**The names.** A field's label sits 6px above its own control and 12px
below the previous one. By proximity alone it belongs to the control
above it. The label is also the same size and weight as the hint text
beside it, so nothing says "this is the name of a thing" rather than
"this is a remark".

**The buttons.** `Save global config` and `Load override` have no space
above them. A button that commits everything above it needs a gap saying
where the thing it commits ends.

**The arrow.** Not the arrow's fault. The field is the full width of the
page — over 900px — to hold the word `high`. Every control is `width:
100%` because none of them was given a width, and a control's width
should suggest the size of the value it holds. Fix the width and the
arrow is beside its word again.

There is a fourth thing the report did not name, and it is the one that
makes the other three worth doing together: this look was never chosen.
The palette is `#f4f1ea` cream with one teal accent, every block on the
same rounded card with the same drop shadow. That is the arrangement
generated interfaces currently converge on, and it is why the screen
reads as unconsidered even where nothing is wrong with it.

Four directions were drawn on the real Harness Settings screen and
compared. The owner asked for a recommendation and took it. What decides
between them is that this product has two kinds of screen — dense forms
and long prose — and a single look has to serve both without fighting
either. See `docs/adr/0023-standalone-shell-visual-direction.md`.

## Capabilities

### New

- The standalone shell has a stated visual direction, and a reason on
  file for it, so the next person to dislike it argues with a decision
  rather than repainting.

### Modified

- A field's name reads as a name: it is bound to its own control by
  proximity and distinguished from prose by weight, not by colour alone.
- A control is as wide as the value it holds, so a one-word dropdown is
  a one-word dropdown.
- A button that commits a section is separated from that section.
- Every colour the shell draws comes from a token, so the palette is one
  block rather than twenty-one values spread through a thousand lines.

## Out of scope

The VS Code extension's appearance. It maps the same tokens onto the
editor's own theme variables and must keep following whatever theme the
person chose; a product that repainted its own panel inside somebody's
editor would be wrong. Every token this change adds gains a mapping
there, and that is the whole of the extension's share.

Rearranging what is on the screens. This changes how the existing
elements are drawn and spaced, not which elements exist, what they say,
or where they live. A redesign of the Harness Settings page's content —
the template list in particular, which is four dense paragraphs in a
bulleted list — is real work and is not this.

New capabilities of any kind. No setting gains a control, no screen
gains a section.

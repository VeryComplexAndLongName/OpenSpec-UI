# 0023: The Standalone Shell Commits to an Editor-Native Look

Status: Accepted

Date: 2026-09-11

## Context

The owner reported on 2026-09-10 that parameter names cannot be told
from their values, that buttons sit flush against the inputs above them,
that a dropdown's arrow is at the far right of a page-wide field, and —
summarising — that the design is not good.

The first three are information-design faults with mechanical fixes.
The fourth is the one that needs a decision: the shell's appearance was
never chosen. It is `#f4f1ea` cream with a single teal accent, every
block on the same rounded card with the same drop shadow. That
combination is what generated interfaces currently converge on, which is
why the screen reads as unconsidered even where nothing on it is wrong.

Repainting without deciding would produce the same situation in a
different colour, and would be re-litigated the next time somebody
dislikes it. So the direction is recorded here.

Four directions were drawn on the real Harness Settings screen, using
its real content — the stage rows, the two mechanical stages, the
autonomy level, the review gate, the save button — and compared side by
side.

The constraint that decided it is that this product has two kinds of
screen. **Dense forms**: Harness Settings, Processes and Recovery,
Templates. **Long prose**: proposals, the change editor, the timeline,
diffs, and the live stream of an agent's own text. One look has to serve
both.

## Decision

1. **The standalone shell takes an editor-native look**: a settings
   pane rather than a page. Low contrast between surfaces, radius small
   enough to soften a corner rather than announce a card, one shadow
   spent only on what genuinely overlays, a type scale that stays out of
   the way, and a two-column arrangement wherever a row is a name and a
   value.

2. **Separation is spent by role, not applied uniformly.** Border, fill,
   radius and shadow each say "separate object". Today all four are
   applied to every block, so the headline, the tab strip, a panel and a
   list row claim equal importance and the reader is given no order to
   read them in.

3. **Every colour is a named token, and the name says what it is for.**
   `--diff-added-bg`, not `--pale-green`. The 21 literals currently
   written into the rules move into `:root` before anything visible
   changes, because a palette applied over them comes out patchy in
   exactly the places nobody checks.

4. **The extension is untouched, and every new token gains a mapping
   there.** `vscodeThemeCss` redefines the same names against the
   editor's theme variables. A tool that repainted its own panel inside
   somebody's editor would override a choice that is theirs. A token
   defined in one layer and missing from the other renders with no
   value, so a test asserts the two layers carry the same names.

5. **Contrast is a gate, not an aspiration.** The browser suite's axe
   run covers WCAG AA, and the muted-text token is set from the contrast
   requirement rather than from taste. A quieter palette fails there
   first.

## Rejected Alternatives

### Metro 5

The owner named it, which is why it was drawn rather than dismissed.
Flat, square, typographic; colour as a signal rather than a surface.

Rejected because tiles are a launcher's language, not a form's: on
Harness Settings they decorate the header and then an ordinary form
begins. The parts of it that are genuinely good here — no card, no
shadow, colour used sparingly, labels small and bold — are adopted by
decision 1 and 2 without the tiles.

### Console

Monospace throughout, values in one aligned column, leader dots, dark by
commitment. The most specific of the four to what the product does: it
drives command-line agents and streams their output back.

Rejected on the prose half of the constraint. `acp-text-reads-as-prose`
was shipped the same week specifically so that an agent's streamed reply
reads as prose rather than as slices; setting the whole shell in 14px
monospace would undercut that. Monospace is right for values and wrong
for paragraphs, and this product has many paragraphs.

### Specification

Rules instead of cards, a serif for prose, monospace reserved for the
names of things, controls as underlined values inside a sentence. The
most characteristic of the four, and the most specific to a product
whose subject is written specifications.

Rejected on the form half of the constraint, and narrowly. Underlined-
value controls get fiddly in a dense form, and diffs and code need
monospace anyway, so the serif would live in patches. Worth revisiting
if the reading screens ever separate from the operating ones.

### Repaint the palette and stop there

Rejected: the complaint that the design is not good is mostly about
labels, widths and spacing. A new palette over the same information
design produces the same screen in a different colour, having spent the
one moment when changing it was easy.

## Consequences

- The look is deliberately unremarkable, which is the one quality nobody
  thanks you for. It is the right outcome for a window left open while
  agents run: the output is what should be looked at.
- Every screenshot under `docs/images/standalone/` changes in one
  commit. They are generated from the running UI by the browser suite,
  so they are regenerated rather than edited.
- The standalone shell and the extension will look less alike than they
  do now in one sense — the extension follows the editor's theme, which
  may be anything — and more alike in another, since both become a
  settings pane rather than a page of cards.
- A future direction argues with this ADR rather than with a stylesheet.

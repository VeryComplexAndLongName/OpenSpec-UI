## Context

- `PipelineView` holds two polled readings: this directory's readiness
  report every 10 seconds and, where the host gives one, the survey of
  every working directory every 30. It renders nothing but a loading note
  until the first arrives, and nothing but an error when it fails — the
  survey's result included.
- A card is absolutely placed at coordinates core derived, with a fixed
  width and height in `--u`, a `rem` (ADR 0025). Its name never shrinks
  and does not wrap; its state is one line; its detail lines wrap, and
  whatever passes the bottom is clipped by `overflow: hidden`, so the
  last visible line can be cut through. Every line is in the DOM on
  purpose: a fixed card must not be able to remove a fact the change is
  required to state.
- At phone width the cards become lanes with `height: auto`, and nothing
  is clipped.

## Decisions

**The two readings render independently.** The tab keeps one frame; this
directory's part shows the loading note, the error or the picture, and
the other directories' part shows whatever the survey has returned. The
read-at line always renders and says "not read yet" for a reading that
has not arrived.

**Which lines fit is derived, not measured.** Measuring would bring
back exactly what ADR 0025 rejected for edges: state derived from a
moment of rendering, checkable only in a browser. Instead core states a
card's vertical chrome and each line's height as `rem` tokens — padding,
the name line, the state line, a detail line — and returns, for a card
of a given height, how many detail lines fit whole. The stylesheet is
written from the same constants, so the two cannot drift, and a test
pins that.

**A detail line is one line.** It no longer wraps; it ends with an
ellipsis at the card's width. A wrapped line is what made the count of
lines depend on the text and the font, which cannot be known without
measuring.

**Lines past the budget are hidden visually, not removed.** They keep
their text in the DOM and in the card's accessible name, with the same
visually-hidden treatment the shell already uses for text meant only for
assistive technology. The last drawn line becomes a short "more" sign,
and the full text stays in the card's `title`. Local and foreign cards
alike.

**Phone width is unchanged.** Lanes have no fixed height, so every line
is drawn and none is hidden.

## Risks

- A reader's minimum font size can override `rem`-sized text. Lines are
  then taller than the tokens say and the last one can still be cut.
  That is the cost ADR 0025 already accepted for fixed cards; the
  full text in the title and in the accessible name is still there.
- A single-line detail truncated at the card's width can end mid-word.
  The ellipsis says so, and the full text is on the element.

## Context

ADR 0045 decides that an action is named `<Verb> <Noun>` from approved
lists, and every-action-is-a-verb-and-a-noun applied it to the extension's
commands and the CLI's subcommands. The web UI's buttons were outside its
test. ADR 0047 decides that what waits for a person is a dialog.

## Goals / Non-Goals

**Goals:** every web UI button reads as a pair or, inside a dialog, as its
verb; every Danger button asks first; a test keeps it so.

**Non-Goals:** switches, tabs and choices of a view (By stage, One change,
Sprint report), which say what they show; labels built from a value (a
run path's title, an agent's name), which their own tests cover; published
articles and earlier ADRs.

## Decisions

- **The label is the pair; the accessible name starts with it.** A card
  shows "Stop Run..." and is named "Stop Run alpha": WCAG's label in name,
  and a screen reader still hears which card. Three dots stay out of the
  name, as before.
- **Inside a dialog, the verb alone.** The dialog's title already names
  the object ("Archive Landed Changes"), so its submit says "Archive", as
  every system dialog does. The same holds for Answer, Allow and Deny on a
  card or the banner, whose prompt says what they answer.
- **Danger asks in a dialog.** The confirmations use `ModalLayer` (ADR
  0047): Escape and Cancel close it, nothing is deleted until its submit.
  Delete Template... keeps the browser's own confirm it already had.
- **The test reads the source.** As the extension's manifest test reads
  its manifest, `control-vocabulary.test.ts` reads every `.tsx` for the
  words a `<button>` writes - its text, a string child, the two strings a
  child chooses between - and the `saveLabel`/`applyLabel` and
  `OPEN_TARGET_WORDS` values. A pressed button or a tab is a switch and is
  skipped. A second test fails if the scan finds none of the labels it is
  meant to, so an empty scan cannot pass.
- **New words.** Schedule (Run: "Schedule Run") and Save (Set up: "Save
  Settings", "Save Change") join the verbs. Nouns: Main, Landed Changes,
  Logs, Path, Done Tasks, Chain, Agents, Command, Proposal, Design, Stage
  Agents, Settings, Templates, Summary, Configuration, Processes.

## Risks / Trade-offs

- Someone used to "Start..." looks for it once → the card's first button
  is the same button in the same place; the palette already says "Run
  Change...".
- The scan reads text, not the rendered DOM → a label assembled at run
  time escapes it; those are values, and their components' tests name
  them.

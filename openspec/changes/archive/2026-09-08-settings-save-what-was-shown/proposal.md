# Save what the settings view was shown

## Why

Saving from the harness settings view destroys configuration it never
displayed.

`writeGlobalHarnessConfig` and `writeChangeHarnessConfig` replace the file
wholesale. The global form sends two of the eight accepted top-level keys
(`stepAgents`, `autonomyLevel`); the per-change form sends three. The
other five or six are written out of existence by pressing Save —
including `timeout`, `maxStageAttempts`, `budget`, `checkpoints`, and
`gitStageAllowlist`, which says which paths a chain may stage.

This makes the templates shipped a day earlier decorative. Applying one
fills the form, recomputes the diagnostic panel, and reports "Filled from
Careful. Nothing is saved until you save." Then the save drops every
ceiling the template exists to set. The visible half is right and the
acted-upon half is not, which is the failure this project has rejected
three times already — for a spend that was not reported, a ceiling that
cannot act, and two accepted keys that vanished on the way back out.

Found by the owner on 2026-09-08 while verifying `settings-templates`:
Overnight was not offered anywhere. It is per-change only, and the
per-change section has no template picker at all — so the one template
whose point is a long unattended run cannot be applied from the UI. That
was the visible symptom; the save path is the cause underneath it.

## Capabilities

### Modified

- The harness settings view saves the whole configuration, not the part
  it has fields for.
- Templates are offered for a change, not only globally.

## Out of scope

Adding form controls for every dropped key. Editing a ceiling in the UI
is a separate question from not destroying one; this change is about the
second, and a field added here would be a field nobody asked for.

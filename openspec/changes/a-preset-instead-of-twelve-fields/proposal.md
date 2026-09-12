# A preset instead of twelve fields

## Why

`HARNESS.md` documents nine top-level keys, four stage entries with four
fields each, five settings a global file may not set, and five no UI can
edit. Configuring a change to run unattended means getting
`autonomyLevel`, `checkpoints.requireConfirmationBetweenSteps`,
`reviewGate.mode`, a budget and four `stepAgents` entries consistent
with one another — where two of those five are refused in the global
file and only accepted per change.

Raised in review on 2026-09-12: the settings keep growing and the point
is to make a person's life simpler. The repository has been answering
this one field at a time — `setup-offers-only-what-applies` removed
choices that could not apply, `an-autonomy-level-says-what-it-does`
renamed one so it read as what it did, `a-setting-reads-as-a-setting`
did the same elsewhere. Each was right and none of them changes the
shape of the problem: the unit a person configures is a whole intention
("run this without me", "be careful with this one"), and the unit the
product offers is a field.

## Capabilities

### New

- Named presets — each a documented set of values for keys that already
  exist, with the intention it serves stated in the same words a person
  would use.
- Applying one writes the ordinary JSON those keys live in, so the
  result is a file that can be read, reviewed, hand-edited and
  committed.
- Both hosts offer them where the harness is configured, and the CLI
  can apply one.

### Modified

- The harness settings surfaces lead with the presets and keep every
  field beneath them, so the fields remain the way anything specific is
  reached.

## Out of scope

A new configuration layer. A preset is not a key in `harness.json`, not
a mode the resolver knows about, and not something a running chain
consults. It writes the same JSON a person would have written and then
has no further existence — see `design.md` for why the alternative was
rejected.

New settings. A preset that needed a key the harness does not have would
be a product change wearing a preset's clothes; each preset is expressed
entirely in keys that exist today, and a preset that cannot be is
reported as a finding.

Deciding a preset for the user. Nothing applies one on its own, and none
is applied to an existing configuration without saying which fields it
would change.

Presets for anything but the harness. The same complaint applies to
other settings surfaces; whether it generalizes is not decided here.

# Design

## Context

`TOP_LEVEL_CONFIG_KEYS` accepts eight keys. Measured 2026-09-08 by
reading the two save paths in `HarnessSettingsView.tsx`:

| Key | Global save sends | Per-change save sends |
| --- | --- | --- |
| `stepAgents` | yes | yes |
| `autonomyLevel` | yes | yes |
| `reviewGate` | no | yes |
| `checkpoints` | no | no |
| `budget` | no | no |
| `timeout` | no | no |
| `maxStageAttempts` | no | no |
| `gitStageAllowlist` | no | no |

Both writers replace the file. So a key absent from the payload is not
left alone — it is deleted.

## Decision: the view carries what it loaded

The loaded configuration is kept and the form's fields are laid over it
at save time, rather than the payload being built from the fields alone.

The alternative — merging in the writer — was rejected. A writer that
merges cannot express deletion, so removing a key would need a second
path, and every caller would have to know which of the two it wanted.
Worse, it would hide this defect rather than fix it: the view would still
not know what it holds, and the next field added to the file would be
invisible to it again in the same way.

Keeping it in the view also keeps the honesty local. The view is what
told the operator "nothing is saved until you save"; it is the thing that
should be able to make that sentence true.

## Decision: a test that names the keys, not the fields

The guard iterates `TOP_LEVEL_CONFIG_KEYS` and asserts that a
configuration carrying every one of them survives load → save unchanged.
Naming the fields instead would pass while the ninth key is added and
forgotten, which is precisely how this happened.

This is the same shape as the guard in
`config-keys-survive-a-round-trip`, one layer up: that one covers the
reader, this one covers the view. Both exist because the failure is
silent and cheap to reintroduce.

## Decision: the per-change section gets the picker

`templatesForScope("change")` already returns all three templates and is
already exported. The picker component already exists and is already
scope-aware. Only its second mounting is missing, which is why Overnight
has never been reachable.

Applying a template per-change fills the change form the same way the
global one does, and the same sentence is shown. That sentence is only
true once the save above carries the ceilings, so the two parts of this
change ship together — a picker that offers Overnight and then silently
drops its four-hour ceiling would be worse than the picker being absent,
because absence is at least visible.

## Consequence: the global save writes resolved defaults

`resolveGlobal` returns a fully-defaulted configuration, not the file. So
laying the form over it writes every default explicitly into the global
file — `checkpoints`, `budget` and the rest appear where they were absent
before.

For the global file this changes no behaviour: it is the base level, so a
default written explicitly and a default inherited resolve the same. What
it does change is that the value is now pinned — if the product default
moves later, a file that pinned it will not follow.

That is a smaller harm than deleting a ceiling someone set, so it is
accepted here and stated rather than hidden. The clean fix is a `readGlobal`
that returns the file unresolved, which crosses the webui API, the REST
route and the extension bridge; it is left for its own change.

The per-change side has no such trade. `readChangeOverride` returns the
file itself, so the override save carries exactly what was there.

## Rejected: warning that a key will be dropped

A dialog saying "saving will discard `timeout` and `gitStageAllowlist`"
would be honest about a behaviour that should not exist. There is no
reason a person editing an agent assignment should be asked about a
ceiling they never mentioned.

## What this does not decide

Whether the settings view should let a person edit ceilings, attempts,
checkpoints or the git allowlist directly. Those keys are currently
edited in the file, and that stays true here. This change only stops the
view from deleting them.

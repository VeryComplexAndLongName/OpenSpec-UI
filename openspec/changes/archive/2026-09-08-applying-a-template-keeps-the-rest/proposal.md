# Applying a named configuration keeps what it does not mention

## Why

Applying a template from the Run dialog writes the template's
configuration as the change's whole file. `writeChangeHarnessConfig`
replaces, so every key the change had and the template does not mention
is deleted.

That includes `gitStageAllowlist`, which says which paths a chain may
stage. A person who applies "Thrifty" to get a cheaper run loses the
constraint on what the agent is allowed to commit, and nothing says so.

This is the third time this project has found the same defect, and the
first time it was introduced rather than inherited:

- `settings-save-what-was-shown` — the settings view sent two of eight
  accepted keys and the writer replaced the file.
- `config-keys-survive-a-round-trip` — two accepted keys passed
  validation and vanished on the way back out.
- here — a surface added hours after the first fix, in the same
  repository, replacing a file for the same reason.

The settings view does this correctly: applying a template there fills
the form, and saving lays it over what was loaded. The Run dialog writes
directly and skipped that step.

## Capabilities

### Modified

- Applying a named configuration sets what it names and leaves the rest
  of the change's configuration alone.

## Out of scope

Whether applying a template should be able to remove a key. It cannot
today from any surface, and inventing a way to here would be a second
question answered in passing.

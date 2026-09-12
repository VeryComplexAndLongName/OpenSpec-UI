# Design

## Decisions

**A preset is a value, not a mode.** `HARNESS_PRESETS` in
`packages/core/src/harness-presets.ts` is a list of
`{ id, title, intention, scope, values }`, where `values` is a partial
`HarnessConfig`. Applying one merges `values` into the target file and
writes it. Nothing records that a preset was used, and nothing reads a
preset at run time.

Rejected: a `preset` key in `harness.json` that the resolver expands. It
would be a third configuration layer over the two that exist, and every
question the reader has — what is actually set, why did this stage get
that agent — would need the preset table to answer. It also creates a
class of bug this repository has already had twice: a per-change file
that overrides part of something and silently inherits the rest
(`stage-override-keeps-the-rest`, `a-stage-override-keeps-its-custom-agent`).

**Applying says what it will change, before it changes it.** Applying a
preset to a file that already has values produces a diff of the keys it
would overwrite, and is confirmed against that. A preset applied to an
empty file is the common case and shows the same summary.

Rejected: applying only to keys that are unset. A preset is an
intention, and one that silently skipped the fields a person had already
set would produce a configuration matching no preset and no intention.

**Scope is part of the preset.** Some values a global file may not carry
at all (`autonomyLevel: "autonomous"`, `reviewGate.mode:
"agent-sufficient"`, `checkpoints.requireConfirmationBetweenSteps:
false`, and the two keys global files may never set). A preset declares
whether it applies to the workspace default, a single change, or either,
and the surfaces offer only what applies — the rule
`setup-offers-only-what-applies` already established.

**Three presets, and the constraint that there are few.** "With me
watching" (assisted, confirmation between stages, human review gate),
"Unattended, careful" (semi-autonomous, no confirmation, human review
gate, a budget), "Unattended, all the way" (autonomous, no confirmation,
agent-sufficient review gate, a budget, per-change only — it is what
lets the `git` stage push and merge). A fourth is a proposal with its
own justification: a list of presets long enough to need reading is the
problem it was meant to solve.

**Written by core, offered by the hosts, applied by the CLI too.**
`applyHarnessPreset({ workspaceRoot, changeName?, presetId })` in core
does the merge and the write; `webui` offers the list where the settings
already are; `openspec-ui-cli harness preset <id>` applies one from a
terminal. No host computes a preset's values.

## Non-Goals

- Any new configuration key, at either file.
- Changing what any existing key does, or which keys a UI can edit.
- Presets applied automatically, at setup or anywhere else.
- Presets for settings outside the harness.

## Risks / Trade-offs

**A preset hides what it set.** Mitigated by writing plain JSON into the
file the reader already knows about, by showing the diff before writing,
and by the presets being documented in `HARNESS.md` with their exact
values. The failure mode avoided is the resolver-level preset, where the
file says one word and the behaviour comes from a table.

**Three presets will not fit everybody.** That is intended: the fields
stay, directly beneath, and a preset is a starting point somebody then
edits. What would not be acceptable is a preset that is nearly right and
cannot be edited.

**A preset can drift from what the keys mean.** `HARNESS.md` documents
the values, and a test asserts each preset resolves through
`resolveHarnessConfig` to exactly the configuration its documentation
claims — so a change to a default that silently alters a preset fails.

**Protocol impact: none.** No command or event is added or changed.
Writing a configuration file is something both hosts already do through
the existing settings path; this change adds a value to write, not a way
to write it.

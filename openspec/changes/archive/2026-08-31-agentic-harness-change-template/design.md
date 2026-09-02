## Context

See `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` and
`docs/adr/0012-agentic-harness-chain-execution-protocol.md` for the
underlying config/execution model this command configures — no protocol
or security-model change here, purely a UI flow over already-existing
core functions (`createChange`, `writeChangeHarnessConfig`).

## Goals / Non-Goals

**Goals:**

- One command that creates a change and, in the same flow, optionally
  writes a per-change harness override reflecting explicit user answers —
  no separate "create" then "configure" round trip for the common case of
  wanting a non-default split for a specific change.
- Never write a harness.json the user didn't actually ask to customize —
  "use global defaults" and an all-"(inherit)" customization pass both
  result in no file, identical to today's "no per-change override"
  behavior.

**Non-Goals (this change):**

- Not a replacement for `openspec-ui.createChange` or
  `openspec-ui.configureHarnessForChange` — both keep working exactly as
  today; this is an additional, more guided path.
- Not asking about the `git` stepAgent (see Decisions below).
- Not building the standalone webui side of this — `HarnessSettingsView`'s
  existing per-change override section already lets a user type a change
  name and configure it there right after creating one in the Change
  Editor tab; a deeper standalone integration (e.g. auto-navigating there
  with the name pre-filled) is a small, separable follow-up, not required
  to deliver the VS Code command asked for directly.
- Not validating that the chosen agents are actually installed/detected —
  matches the existing Harness Settings UI and Agent Selection picker,
  which annotate ("detected"/"not detected") but never filter or block a
  choice (see `agentic-harness`'s own spec, "Annotate, don't filter").

## Decisions

### Sequential QuickPick wizard, not a single form

VS Code has no built-in multi-field form widget; a webview-based custom
form would duplicate `HarnessSettingsView`'s React implementation for a
narrower use case. A sequential `showQuickPick` wizard (one question at a
time, Esc cancels the rest) is the established pattern in this codebase
for exactly this shape of interaction — see `openspec-ui.
insertTemplateIntoChange`'s per-variable prompt loop, which this change
mirrors.

### Cancelling mid-wizard discards the whole customization, not a partial file

Rejected alternative: persist whatever was answered so far. Rejected
because a harness.json that reflects only the first two of six questions,
with no indication to the user of which ones were actually decided versus
abandoned, is a worse, more confusing state than "no per-change override
at all" (which already has clear, existing meaning: inherit the global
default in full). The change itself is still created either way — only
the harness customization is all-or-nothing.

### Why `git` is not part of the wizard

`stepAgents.git` has no functional consumer today — no command maps to
it, and the `git` stepAgent's actual commit/push action remains deferred
(see `agentic-harness-autonomy`'s design.md and the "Considered, not
pursued here" ACP note there). Asking a sixth question with no observable
effect adds friction for no current benefit; `git` remains settable later,
by hand or via `openspec-ui.configureHarnessForChange`, once/if that
action ships.

### Only write the file if something actually deviates from inherit/default

Checked after collecting all answers, not per-question — writing early
and patching per-question would need to also handle "the user later
picks '(inherit)' again for a stage already written," which is more
state to manage for no benefit over collecting everything in memory first
and writing once at the end.

## Risks / Trade-offs

- **[Risk]** Six sequential prompts (four stages + autonomy + review gate)
  is more friction than a single dialog. → **Mitigation**: "Use global
  Agentic Harness defaults" is the first choice offered and is a single
  click/Enter — the multi-step wizard is opt-in, not the default path.
- **[Trade-off]** No standalone webui wizard in this change (see
  Non-Goals) — a standalone user gets the same outcome through two
  existing, already-shipped UI pieces (Change Editor's "Create change",
  then Harness Settings' per-change override section) rather than one
  guided flow. Acceptable because both pieces already exist and work;
  this change's value is specifically the VS Code guided flow that
  doesn't exist yet.

## Migration

None — additive command only.

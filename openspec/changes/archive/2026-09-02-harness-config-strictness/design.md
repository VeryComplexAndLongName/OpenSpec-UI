## Context

See `proposal.md`. Facts read from `harness-config.ts`'s
`assertValidStepAgents`:

- `agent` must be a non-empty string in `KNOWN_AGENT_IDS`.
- `model` must match `MODEL_ID_PATTERN` **and** the agent must have a
  `modelFlag`.
- `effort` must be a known value **and** be in that agent's accepted set.
- `budget` must be an object setting exactly one of `maxCostUsd` /
  `maxAiCredits`, positive, matching that agent's `budgetField`, and at
  least `COPILOT_MIN_AI_CREDITS` where it applies.
- `dispatch` must be `"cli"` or `"vscode-chat"`, and `"vscode-chat"` only
  under `autonomyLevel: "assisted"`.

So each parameter is already checked against the **agent**, thoroughly.
Two things are not checked at all: the parameter against the **delivery
mode**, and any key the reader does not name. The function ends after the
`budget` block; there is no unknown-key branch.

## Goals / Non-Goals

**Goals:**

- Select chat dispatch by naming it, not by naming an agent and then
  overriding it.
- Refuse any parameter that cannot reach anything, whatever the reason.
- Refuse an unrecognized key rather than reading it as an omission.

**Non-Goals:**

- Changing chat dispatch's behavior (ADR 0016).
- Touching `stepAgents.archive` — `harness-mechanical-checks` owns that.
- Broadening validation beyond `stepAgents`.

## Decisions

### Chat dispatch becomes an agent id

A stage says what runs it in one field. Chat dispatch is one of the
things that can run it.

**Rejected alternative**: keep `dispatch` and make `agent` optional when
it is `"vscode-chat"`. Rejected — it leaves two fields that must agree,
and the reader still has to know that one silences the other. The
question that prompted this change ("why name an agent that is never
used?") would still have no good answer; it would only be answerable
differently.

**Rejected alternative**: keep `dispatch` and validate every parameter
against it. Rejected as insufficient rather than wrong: it fixes the
silent-ignore half and leaves the naming half, and the naming half is
what makes the configuration read as if an agent were involved.

### Every parameter is validated against what actually runs the stage

`model`, `effort` and `budget` are refused when the selection has no way
to carry them — which for chat dispatch is all three, since no argv is
built at all.

**Rejected alternative**: accept and ignore them, since chat dispatch is
assisted-only and a human is watching. Rejected — that is precisely the
behavior ADR 0019 and `harness-step-effort-and-budget` task 2.2 forbid,
and being watched is not being told. The user who set `"effort": "high"`
saw a run that honoured it in no way and no message saying so.

### An unknown key is an error, and the error lists the accepted ones

**Rejected alternative**: ignore unknown keys, as JSON configuration
commonly does. Rejected — the failure is invisible and the cost is a full
run: `"modle": "claude-opus-5"` yields the default model, a plausible
result, and nothing to notice. This project has spent the week removing
settings that pretend to work; a silently dropped key is the same defect
one layer down.

**Rejected alternative**: warn rather than refuse. Rejected on this
repository's own evidence: a warning about a known-bad state trains
people to stop reading it. `npm run lint` was expected-red for days, so a
real error passed unread until CI caught it.

### Existing configurations are migrated, not refused

A file still using `dispatch` is read, mapped to the new form, and
reported once.

**Rejected alternative**: refuse it and require an edit. Rejected — this
repository's own configuration uses the old shape, as does every
workspace that copied the documented example. The same reasoning
`harness-mechanical-checks` applies to `stepAgents.archive`: a setting
that used to be valid must not become a setting that breaks the load.

## Risks / Trade-offs

- **[Risk]** Refusing unknown keys breaks a workspace that carried a
  harmless extra key — a comment field, a leftover from an older shape.
  → **Mitigation**: the error names the key and the accepted set, so the
  fix is one edit and obvious; and the alternative is that a misspelled
  real parameter stays invisible, which is the more expensive failure.
- **[Risk]** Two names for the same concept during migration. →
  **Mitigation**: the migration reports once per load, and the tasks
  require the reported message to name the replacement.
- **[Trade-off]** A stricter loader rejects configurations that used to
  load. Accepted deliberately: every rejection it adds is a case that
  previously ran and did something other than what was written.

## Migration Plan

A configuration using `dispatch: "vscode-chat"` is mapped to the new
agent id on read and reported; one using `dispatch: "cli"` drops the key,
since it was the default. Parameters that were silently ignored under
chat dispatch now fail the load — deliberately, since they never had an
effect, and the load message says so.

## Open Questions

- The agent id for chat dispatch. It must read as a delivery target
  rather than a model, and must not collide with an existing id; the
  tasks require the choice to be stated in the registry's own comment
  rather than left implicit.

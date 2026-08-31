## Context

See `openspec/changes/agentic-harness-change-template/` for the sibling,
per-change wizard this one deliberately mirrors in style (sequential
`showQuickPick` questions) but differs from in one key way — see
Decisions below. No protocol or security-model change; purely a UI flow
over already-existing core functions (`detectAvailableAgents`,
`writeGlobalHarnessConfig`, `writeAgentInstructions`, `initOpenSpec`).

## Goals / Non-Goals

**Goals:**

- A new user finishes `openspec-ui.initialize` with a real, considered
  `openspec/agent-harness.json` — not silence until they happen to
  discover "Configure Harness Settings" later, if ever.
- Every choice offered is one the user can actually act on: only
  detected agents, only autonomy levels the global file can actually
  hold, no dead-end options.

**Non-Goals (this change):**

- Not a standalone webui wizard — `HarnessSettingsView`'s existing global
  form already covers the same ground for that host; this is specifically
  the guided, ask-once-at-setup path for the case that currently has none
  at all (VS Code's `initialize` flow).
- Not asking about per-stage detail beyond the control/apply split — a
  user who wants `review` on a third agent, or `git` set at all, still
  has the existing "Configure Harness Settings" for that; this wizard
  optimizes for the common two-role split (this repository's own
  configuration is exactly that split), not full generality.
- Not validating that a chosen agent is actually authenticated/working —
  matches the existing product-wide stance (detection is presence-only,
  see `agentic-harness`'s "Annotate, don't filter").

## Decisions

### Cancellation is per-question here, not all-or-nothing

`agentic-harness-change-template`'s wizard discards everything on Esc,
because a partially-filled *per-change override* is genuinely ambiguous
state (which fields were decided vs. abandoned is not visible later,
and "no override file" already has clear, existing meaning). This
wizard's every question is instead an independent, immediately meaningful
write to the *global* file: answering "control agent" alone and then
cancelling still leaves a global file with a real, intentional
`stepAgents.propose`/`review`/`archive` set — a strict improvement over
no file at all, not an ambiguous partial state. Each answered question is
written progressively (see "Writes progressively, not once at the end"
below), so cancelling never loses an already-given answer.

### Writes progressively, not once at the end

Each question's answer is written via `writeGlobalHarnessConfig`
immediately after it is given (merging into whatever is already on
disk), rather than accumulated in memory and written once at the end.
Rejected alternative: accumulate-then-write-once (matches
`createChangeTemplate`'s pattern) — rejected specifically because this
wizard's cancellation semantics require every prior answer to already be
durable the moment the user stops, not just held in memory until a final
step that might never come.

### `autonomous` is not offered at all, not offered-then-rejected

The QuickPick's own option list only ever contains `assisted`/
`semi-autonomous`. Rejected alternative: offer all three and let
`writeGlobalHarnessConfig`'s existing `GlobalAutonomousAutonomyLevelError`
reject `autonomous` with an error message — rejected because presenting a
choice that is guaranteed to fail is worse UX than not presenting it, for
a restriction that is already fully enforced elsewhere (this wizard adds
no new enforcement, only avoids offering a dead end).

### Detection reuses `detectAvailableAgents()`, not a new mechanism

Same function the Agent Selection picker's "(detected)"/"(not detected)"
annotations already use (`agent-detection.ts`) — no second detection
implementation, no risk of the two drifting on what "installed" means.

### Suggestion is dismissible, not a blocking follow-up dialog

`showInformationMessage` with an action button after `initialize`
succeeds, not an automatic `showQuickPick` chain — a user who just wanted
the OpenSpec scaffold and nothing else is not forced through six more
prompts immediately. The re-runnable command remains available at any
later point for a user who dismisses the suggestion and changes their
mind.

## Risks / Trade-offs

- **[Risk]** A user runs the wizard twice (once via the post-`initialize`
  suggestion, once later manually) and is confused why some questions
  show "(already set: `<value>`)" while others don't. → **Mitigation**:
  every question's QuickPick reads the current resolved value first and
  shows it as the pre-selected/first item, so re-running is idempotent
  and legible, not surprising.
- **[Trade-off]** Only a two-role (control/apply) split is offered, not
  full per-stage granularity — a user who wants a three- or four-way
  split must still use "Configure Harness Settings" afterward. Accepted:
  this wizard's job is a good, common-case default reached quickly, not
  full generality (see Non-Goals).

## Migration

None — additive command + one new post-success suggestion on an existing
command; no change to `initOpenSpec`'s own behavior or return value.

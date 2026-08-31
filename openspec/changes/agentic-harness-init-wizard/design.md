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

### `claude-cli` version-compatibility check is scoped to `claude-cli` alone, and is a warning, not a block

Only `claude-cli`'s selection triggers a `claude --version` check, and
only when `acp-agent-adapters` has actually landed (see "Ordering
against `acp-agent-adapters`" below). The other three ACP-flavored
adapters (`copilot-cli`, `gemini-cli`, `codex-cli`) speak an actual
versioned protocol (ACP itself) that negotiates capabilities at session
start — a CLI version mismatch there degrades through the protocol's own
mechanism, not silently. `claude-cli`'s ACP-flavored adapter has no such
protocol underneath it: it is an in-house parser of one specific CLI's
undocumented `stream-json` output shape (`acp-agent-adapters/design.md`'s
own "Load-bearing facts" section), verified against exactly one version
(`2.1.237`). A version drift there has no negotiation layer to degrade
through — it just silently misparses or breaks. That asymmetry, not a
general "check every agent's version" policy, is why only `claude-cli`
gets this.

The check is a dismissible warning (`showWarningMessage`, one action:
"Continue anyway"), not a hard stop — consistent with this wizard's
existing Non-Goal ("Not validating that a chosen agent is actually
authenticated/working... detection is presence-only"). It differs from
that Non-Goal in *kind*, not severity: that Non-Goal is about not
verifying an agent is functional at all (out of scope everywhere in this
product); this check is about a specific, already-known, already-
documented compatibility ceiling for one specific translation layer —
surfacing already-known information, not adding a new liveness/auth
probe.

**Rejected alternative**: block proceeding until the version matches
exactly. Rejected — a `claude` CLI point release may well be fully
compatible in practice; refusing to proceed on any version delta would be
false-positive-prone and contradicts the product's whole detection
philosophy ("Annotate, don't filter" — `agentic-harness`'s own spec
language). A dismissible warning gives the user the same information
without a hard, possibly-wrong gate.

**Rejected alternative**: check every agent's version, not just
`claude-cli`'s. Rejected — the other three raw-text adapters have no
version-sensitive parsing at all (`spawnAndStream`'s deliberately opaque
text handling), and their ACP-flavored counterparts self-negotiate over
the protocol; there is nothing analogous to warn about for them today.

### Ordering against `acp-agent-adapters`

This specific sub-task depends on `acp-agent-adapters` having already
landed — its `claude-cli-acp` module is where the tested-version constant
must live (single source of truth for "which version was this built
against," not duplicated into the wizard). Both changes are gated on the
same precondition (task 0.1, other agent stepping away) and neither is
implemented yet as of this writing, so either could land first.

**If `agentic-harness-init-wizard` is implemented before
`acp-agent-adapters`**: skip tasks.md 1.4 (the version-check sub-task)
entirely — do not stub it against a constant that does not exist yet.
File it as an explicit fast-follow task inside whichever change
implements `acp-agent-adapters`, referencing this design.md section, so
the requirement is not silently dropped.

**If `acp-agent-adapters` lands first** (the expected order, since it is
already further along — ADR 0013 exists and its own proposal/design/tasks
are already written): implement tasks.md 1.4 as specified, importing the
tested-version constant from wherever `acp-agent-adapters` ends up
defining it.

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
- **[Risk]** The `claude-cli` version check's "tested version" constant
  will go stale the moment a newer `claude` CLI is actually verified
  compatible (or a genuinely breaking one is found) and nobody updates
  it. → **Mitigation**: it lives in `acp-agent-adapters`'s own
  `claude-cli-acp` module, right next to the parsing code it protects
  (not duplicated into this wizard), so updating it is a one-line change
  in the same file a future compatibility fix would already need to
  touch.

## Migration

None — additive command + one new post-success suggestion on an existing
command; no change to `initOpenSpec`'s own behavior or return value.

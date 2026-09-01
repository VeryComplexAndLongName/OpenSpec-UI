## Context

See `proposal.md` for the A/B evidence. `openspec/config.yaml`'s
`rules.tasks` currently holds two rules ("every task must be verifiable";
"security-model tasks need a test"). `CLAUDE.md`'s own "Invariants"
section already documents the mechanism this change relies on: the
`config.yaml` content is "what `openspec instructions` mechanically
returns to every `openspec-propose`/`apply`/... call before it writes
anything".

## Goals / Non-Goals

**Goals:**

- A `tasks.md` written by any architect — human or agent, with or without
  the originating discussion — is specific enough that a context-less
  implementing agent produces the intended change rather than a plausible
  neighbouring one.
- A task the implementer cannot perform is visibly outstanding instead of
  silently checked off.

**Non-Goals (this change):**

- Prescribing granularity for `design.md` or `proposal.md`. Those are
  argument, not instruction: their job is to record why a decision was
  made and what was rejected. Mechanising them would destroy the thing
  they exist for. The rules added here are scoped to `rules.tasks` only.
- Enforcing any of this automatically (a linter over `tasks.md`, a
  validation rule in `openspec change validate`). These are authoring
  rules for a reader, not a machine-checkable schema; an automated
  granularity check is a separate idea with its own false-positive
  problems.
- Changing how tasks are marked complete, or adding a mechanism that
  verifies a checked task really was done. That is a real, separate gap
  (the same one behind `docs/adr/0012`'s terminal-event contract issue),
  not addressed here.

## Decisions

### The rules go in `config.yaml`'s `rules.tasks`, not `CLAUDE.md`

Chosen: `openspec/config.yaml`. It is returned mechanically by
`openspec instructions` to every propose/apply call, so it reaches the
`copilot`/`codex` CLI running `apply` as well as a Claude Code session.

**Rejected alternative**: document the guidance in `CLAUDE.md`. Rejected
— `CLAUDE.md` is read by Claude Code only. Under this repository's own
propose/apply split the implementing agent is deliberately a *different*
tool, so guidance placed there would systematically miss the reader it
most needs to reach. (`CLAUDE.md`'s "Invariants" section already states
this reasoning for the `context` field; this applies the same logic to
`rules.tasks`.)

### Four narrow rules, not a style guide

Chosen: exactly the four failure modes actually observed, each stated as
a rule an author can check their own `tasks.md` against.

**Rejected alternative**: a longer authoring guide with examples and
templates. Rejected — `config.yaml` is injected verbatim into every
propose/apply prompt, so its length is a recurring cost paid on every
call; and the two rules already there set the register (one sentence,
one testable expectation). A guide belongs in `openspec/README.md` if it
is ever wanted, not in the injected context.

### Rule 4 (unperformable tasks) is about honesty, not scope

The observed failure was not that the agent *could not* do task 1.3 — it
was that it *claimed* to have done it. Marking such tasks explicitly
gives the implementer a sanctioned way to report "not done" that does not
look like failure, which is what makes the honest outcome the easy one.

## Risks / Trade-offs

- **[Trade-off]** More granular tasks make `tasks.md` longer, and a
  strong model can in principle be constrained by over-specification.
  Accepted: the implementer is a context-less agent, and the observed
  cost of under-specification (a silently false completion that a human
  had to catch) is higher than the cost of verbosity.
- **[Trade-off]** Every added line in `config.yaml` is re-sent on every
  propose/apply call. Accepted, and the reason the change is four rules
  rather than a guide — see Decisions.
- **[Risk]** Rules stated but never followed, because nothing enforces
  them. → **Mitigation**: partial and acknowledged — they are injected
  into the prompt that writes the tasks, which is the highest-leverage
  point available without building the automated checker this change
  explicitly excludes (see Non-Goals).

## Migration Plan

No migration. Existing `tasks.md` files are not rewritten; the rules
apply to tasks written after this lands.

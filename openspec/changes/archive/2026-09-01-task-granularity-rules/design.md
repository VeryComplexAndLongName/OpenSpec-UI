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

### Six narrow rules, not a style guide

Chosen: exactly the six failure modes actually observed, each stated as
a rule an author can check their own `tasks.md` against.

**Rejected alternative**: a longer authoring guide with examples and
templates. Rejected — `config.yaml` is injected verbatim into every
propose/apply prompt, so its length is a recurring cost paid on every
call; and the two rules already there set the register (one sentence,
one testable expectation). A guide belongs in `openspec/README.md` if it
is ever wanted, not in the injected context.

### Rule 6 names the path, because the failure is silent at every junction

The three-round failure in `harness-step-models` is worth stating
precisely, because it is not a case of an agent doing less than it was
told. Each round it did exactly what the task said. The task said "widen
the type at this layer"; the layer's code then had to compile against a
value it had no use for, and the cheapest correct-looking way to do that
is to drop the field. Types pass. Unit tests pass, because each layer's
tests assert that layer's own contract, which the flattening satisfies.
Nothing in the change is red. Only running the real thing and reading the
spawned command line shows the value never arrived.

The rule therefore asks for two things a "widen the type" task does not:
the path written out end to end, and a check owning each junction rather
than only the ends.

**Rejected alternative**: rely on an end-to-end test instead of a rule.
Rejected — the end of this particular path is a spawned process's argv,
reachable only by a live run, which is exactly the human-only kind of
check rule 4 already exists to keep honest. An automated end-to-end test
would have to fake the process boundary, at which point it no longer
covers the junction that actually broke. The rule and such a test are
complementary; the rule is what makes someone write the test at the right
seam.

### Rule 5 marks on verification, not on intent

The rule ties marking to the moment a task's own verification passes, not
to the moment the agent believes it wrote the code. Both halves are
stated in one rule deliberately: "mark incrementally" alone invites
marking ahead of the work (`changeset-version-automation` 1.3's exact
failure), and "never mark early" alone leaves today's batch-at-the-end
behavior untouched.

**Rejected alternative**: have the harness infer progress from its own
event stream instead of asking the agent to mark tasks. Rejected — the
harness sees opaque stdout text (`spawnAndStream` deliberately does not
parse structured output), so it cannot know which *task* an agent is on.
`tasks.md` is the only shared artifact where that mapping exists, and the
Processes view already reads it.

**Rejected alternative**: make marking a post-run step (the agent reports
which tasks it finished; the harness edits `tasks.md`). Rejected — it
reintroduces the same all-or-nothing timing this rule exists to remove,
and puts the harness in the business of editing a change's own files,
which nothing else in the product does.

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

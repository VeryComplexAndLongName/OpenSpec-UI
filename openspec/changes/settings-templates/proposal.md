## Why

The harness has eight top-level settings, four stages that each take an
agent, a model, an effort and a budget, and three ceilings in three
units. Every one of them is there for a reason, and together they are a
wall.

The person who needs the harness most is the one who has not yet learned
which of those matter. Today they must choose an autonomy level, a review
gate, four agents, and a ceiling in a unit that depends on which agent
they picked — before anything runs. The default is safe and does nothing:
`assisted` will not start a chain at all, so the first experience of the
feature is a configuration exercise.

What is missing is not another setting. It is a way to say what you are
trying to do — run this cautiously, run this overnight, run this cheaply
— and get a configuration that is coherent.

Two things landed recently that make such a thing honest rather than
decorative:

- The product now records what each agent reports, so a template can be
  checked against the ceilings it sets. A template proposing a cost
  ceiling on an agent that reports no cost is a template that lies, and
  that is now detectable.
- The audit log can be read back. Measured over 49 real runs in this
  repository: median 7.7 minutes, p75 19.7, p90 34.9, longest 56.8. Over
  16 runs that reported cost: median $1.94, p90 $7.14, largest $8.67.

Those numbers matter because the obvious guesses are wrong. A ten-minute
stage ceiling — a natural round number — would have cut nearly a third of
the real runs in this repository.

## What Changes

- A small set of named templates, described by intent rather than by the
  fields they set, each applying agents, ceilings and autonomy together.
- Every template states which of its numbers came from measurement and
  which are judgement, so a reader can disagree with the right ones.
- A template is checked against the diagnostic that reports what a
  configuration cannot do. A template producing a finding fails the
  build.
- Templates declare their scope, because three settings are only valid in
  a per-change file and a template offering them globally would be
  refused on save.

## Capabilities

### Modified Capabilities

- `agentic-harness`: a configuration can be chosen by intent, and a
  named intent cannot ship a configuration that contradicts itself.

## Impact

- `packages/core`: the templates and their check. `packages/webui`'s
  harness settings view. Changeset for `core` and `webui`.

## Explicitly out of scope

- **Recommending a template for a particular change.** That reads the
  change's own history and is the next change. This one supplies what
  there is to recommend.
- **Choosing agents that are not installed.** A template names agents;
  whether they exist on the machine is what the agent picker already
  reports, and a template that silently substituted one would be
  configuring something the operator did not choose.
- **A wizard.** Templates plus the existing diagnostic answer the same
  question with no new surface to maintain. If a wizard is still wanted
  afterwards, it will have something true to say.

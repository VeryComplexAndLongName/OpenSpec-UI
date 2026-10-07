# 0041: The Plan Is Updated From Its Review

Status: Accepted

Date: 2026-10-07

## Context

A tester ran `review` on a change in the Pipeline on 2026-10-07. The review
found five things to fix before apply. They then asked: "now I would want
to do opsx:update? Or (again) opsx:propose?" and ran `propose` again. It
wrote nothing: `propose` writes only the planning artifacts a change does
not have yet, and all of them existed. The review's findings were never
read by any later stage; the only way to act on them was outside the
product, in an agent's own chat.

OpenSpec has a step for exactly this, `opsx:update`: revise a change's
existing planning artifacts and keep them coherent with one another. The
product's commands have no such kind (`CommandKind` holds `plan`,
`review`, `implement`, `verify` and the read-only ones), and its chain goes
from `review` to `apply` whatever the review said.

## Decision

1. **A command kind `update`.** It revises the planning artifacts a change
   already has - proposal, specs, design, tasks - so that they answer what
   it is given, keeps them coherent, validates the change strictly, and
   changes no code and no file outside the change's directory. It is the
   product's `opsx:update`.
2. **It is given the last review and the operator's words.** Its prompt
   carries the result of the change's latest completed `review` run, read
   from the audit log's `summary`, and whatever the operator writes when
   starting it. Once the operator can answer an agent's questions
   (ADR 0042), their answers from `decisions.md` are given too.
3. **A review says whether the plan is ready.** The review instruction asks
   the agent to end with a line of its own, `Review verdict: ready` or
   `Review verdict: changes needed`, read as a marker the way
   `Starting task <n>` is (ADR 0029). Prose is not read: no line, no
   verdict.
4. **The chain updates a plan its review sends back.** After `review`, a
   verdict `changes needed` runs `update` before `apply`, on the review
   stage's agent, as part of the review stage; `ready`, or no verdict,
   goes on to `apply` as today. One update per review; the chain
   does not loop.
5. **Every surface offers it.** The AI panel lists `update - revises the
   planning artifacts from the last review and your notes`, with a field
   for notes; a card whose last review said `changes needed` offers
   **Update the plan**; `openspec-ui-cli update <change> [--note <text>]`.

## Consequences

- A review's findings reach the plan without leaving the product.
- The protocol gains a command kind; hosts that list command kinds list it.
- A review that prints no verdict behaves as before.

## Alternatives considered

- **Re-run `propose` with the review in its prompt.** Rejected: `propose`
  writes what is missing and leaves what exists, which is the rule that
  keeps it from overwriting a person's plan; making it rewrite on some
  runs would make that rule conditional.
- **Read the review's prose for "changes needed".** Rejected: a guess
  dressed as a decision; the marker is checked, prose is not.

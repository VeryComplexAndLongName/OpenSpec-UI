# Design

## Context

What each agent accepts, from `HARNESS_AGENT_CAPABILITIES`:

| Agent | Effort values |
| --- | --- |
| `claude-cli`, `claude-cli-acp` | low, medium, high, xhigh, max (5) |
| `copilot-cli`, `copilot-cli-acp` | none, minimal, low, medium, high, xhigh, max (7) |
| `codex-cli` | minimal, low, medium, high (4) |
| `gemini-cli`, `gemini-cli-acp`, `codex-cli-acp`, `local-llm`, `vscode-chat` | none (5) |

## Decision: a configuration names a level, not a value

`max` is not a value `codex-cli` accepts. `none` is not one `claude-cli`
accepts. A configuration storing either is a configuration that is wrong
for some agent the moment it is applied.

So a configuration declares **where in its agent's own range** it sits —
highest, high, medium, lowest — and the value is resolved when it is
applied, against the agent that stage actually uses.

This is the same shape as everything else here: the product states what
it can check, and checks it. The alternative is a literal that validation
would then have to reject, which is a configuration the product ships and
refuses.

## Decision: no configuration sets a model

Three reasons, and the first is enough.

Applying one would discard the model the workspace already chose. That
defect was fixed one change ago for the *merge*; leaving a model in a
configuration reintroduces it deliberately at the source.

Second, nothing can check a model name. Neither CLI lists them, so any
name shipped here is a guess with a shelf life.

Third, it is not the product's decision. A person's model is set in their
own CLI or in their base configuration; a named configuration that
overrides it is answering a question nobody asked it.

The configurations say so in their own text, so a reader is not left to
infer it from an absence.

## Decision: a collision is reported, not hidden

`codex-cli` accepts four values, and four levels over four values can
land two levels on the same one. The resolution says when that happened
rather than presenting two configurations that differ in nothing.

An agent that accepts no effort at all is the extreme of this: all four
collapse to the ceilings alone, and the surface says that rather than
offering four identical choices.

## Rejected: a fifth level to avoid collisions

Adding levels to fit the widest vocabulary makes the narrow ones worse.
Four is the number a person can hold; the collision is rare, visible when
it happens, and honest.

## Rejected: keeping the cost/time titles

They were right about the axis a person reasons on and wrong about what
the product controls. A title promising "$3" is a ceiling, not a price,
and it was read as a price — which is exactly the confusion a title
naming the effort does not create.

The ceilings are still there and still shown; they are no longer the
name.

## The resolution, against every registered agent

Task 5.5, run against `HARNESS_AGENT_CAPABILITIES` on 2026-09-09. A
resolution answering the same thing for every agent would not be reading
the vocabulary, so this is the table that shows it does.

| Agent | highest | high | medium | lowest | Two levels alike |
| --- | --- | --- | --- | --- | --- |
| `claude-cli` | max | xhigh | medium | low | no |
| `claude-cli-acp` | max | xhigh | medium | low | no |
| `codex-cli` | high | medium | low | minimal | no |
| `copilot-cli` | max | high | low | none | no |
| `copilot-cli-acp` | max | high | low | none | no |
| `codex-cli-acp` | — | — | — | — | all four |
| `gemini-cli` | — | — | — | — | all four |
| `gemini-cli-acp` | — | — | — | — | all four |
| `local-llm` | — | — | — | — | all four |
| `vscode-chat` | — | — | — | — | all four |

Three distinct answers for the three vocabularies, and each agent's own
top and bottom value at the ends.

The levels are spaced evenly — 1, 2/3, 1/3, 0 — and that came out of this
table. The tidier-looking 1, 0.75, 0.5, 0 put `high` and `medium` both on
`codex-cli`'s `medium` and left `low` unreachable: two configurations
differing in nothing, in the one vocabulary narrow enough to show it. The
collision report stays, because it is what found this.

Five agents accept no effort, not four as the context table above first
recorded — `vscode-chat` was missed. For those five the configurations
differ in their ceilings alone, which the surface says rather than
offering four identical choices.

## Decision: applying writes the agent beside the effort

An effort without its agent means nothing — `max` is a value `claude`
accepts and `codex` does not — so the stage entry written to
`harness.json` names both. A stage that keeps its agent keeps the rest of
its entry (its model, its budget, its custom agent), since only the
effort was being chosen.

Both hosts write through one function in `core` for this, rather than
each spreading the configuration over the existing file itself. The
per-change file is replaced on write, so anything the configuration does
not mention has to be carried across deliberately — the defect
`applying-a-template-keeps-the-rest` fixed, and one that would otherwise
have to be avoided twice.

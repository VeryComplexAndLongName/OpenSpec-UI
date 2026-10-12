---
title: The agent asks the operator, and the chain waits
summary: An agent can now raise a question for the operator, the chain stops and waits, answers are kept in decisions.md, and the product's own agent asks in its turn from the start.
cover: cover.jpg
cover_alt: The OpenSpec Workbench owl, listening, beside the words The agent asks the operator, and the chain waits
---

An agent ended its run with four decisions it needed from the operator,
and the product offered no way to answer them. A chain would have gone on
to the next stage with them open. The owner decided the same day: questions
are caught, the run stops and waits, nothing goes on without an answer, the
answers are kept in the change's `decisions.md` and in the audit log, and
the product's own agent asks in its turn from the start.

## The marker, the event and the command

Every agent stage's instruction asks for `Question for the operator: <…>`
lines for decisions the agent needs. The product reads them as markers.
`local-llm-acp` gets an `ask_operator` tool that blocks its turn until
answered.

A `question` event and an `answerQuestion` command are added to the
protocol. A `question` waiting kind appears in the run's status. A run
that asked waits instead of completing, in a chain or alone, under every
autonomy level. Once answered, the stage runs again with the answers —
`update` for propose and review, the same command otherwise.

## Where answers live

`openspec/changes/<change>/decisions.md` holds every question and answer.
The audit log records both. An agent run on a change with an open question
is refused.

Questions are answered from the card, the AI panel, the Human-Only Inbox
and `openspec-ui-cli answer`. The card shows open questions with answer
fields; the panel does the same. The Inbox surfaces questions alongside
its usual checkpoint answers. From a terminal:

```bash
openspec-ui-cli answer <changeId> --question "Which branch strategy?" --answer "gitflow"
```

## What this changes about autonomy

Before this, an autonomy level of `full` meant the chain ran without
interruption. Now, a question is a hard stop regardless of autonomy level.
The chain waits for a human answer, even at full autonomy. This is
intentional: a question from an agent is a request for judgment, not a
checkpoint the chain can resolve on its own.

The refusal of a run past an open question is explicit. If someone tries
to start a new agent run on a change that still has unanswered questions,
the product says so and names the open questions. This prevents a second
agent from running while the first is still waiting for an answer.

## What this deliberately does not do

The product does not auto-answer questions. It does not infer an answer
from context, from the change's proposal, or from any other signal. A
question is a question until answered. It does not time out. It does not
escalate. It waits.

The `ask_operator` tool is only available to `local-llm-acp`. Other ACP
adapters do not have it yet. If an agent needs to ask a question and its
adapter does not support it, the agent can still raise the marker in its
output text, and the product will catch it.

## Try it

The code is at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

```bash
openspec-ui-cli answer <changeId> --question <questionId> --answer <answer>
```

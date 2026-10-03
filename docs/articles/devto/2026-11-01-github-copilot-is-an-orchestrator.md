---
title: GitHub Copilot is an orchestrator
published: false
description: GitHub Copilot selects which vendor and which model to use for your request — but it does so with a bias toward the cheapest options, not the best quality. It plays on the side of the user's wallet, not the quality of the result.
tags: openspec, ai, copilot, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/2026-11-01-github-copilot-is-an-orchestrator/cover.jpg
canonical_url: https://openspec-ui.dev/articles/github-copilot-is-an-orchestrator/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/github-copilot-is-an-orchestrator/).*

GitHub Copilot is not a coding model. It is an orchestrator — a system
that decides which vendor's model should handle your request, and then
hands your query off to that model.

This distinction matters, because the orchestrator's incentives are not
aligned with the quality of the output. They are aligned with the cost
of the output.

## The orchestration

When you type a comment in VS Code and Copilot suggests a completion, it
does not generate that completion itself. It selects a model from a set
of available vendors and runs your prompt through that model. The
selection happens internally, without exposing which model was chosen
or why.

This is a fundamentally different architecture from running a model
directly — and that difference has consequences you need to understand.

## The bias toward cost

Copilot's model selection is not random. It is not even primarily
quality-driven. It is cost-driven.

The orchestrator's job is to find "good enough" results at the lowest
cost per request. This is a rational business decision for Microsoft,
but it is not a rational engineering decision for you — if quality
matters.

The result is a system that consistently selects the cheapest available
model that meets a minimum quality threshold, rather than the model that
would produce the best possible output for your specific request.

## What "good enough" looks like

A "good enough" model is one that:

- Produces syntactically correct code
- Does not crash or hang
- Responds quickly enough to maintain a smooth editing experience
- Is cheap enough to run at scale

But "good enough" is not the same as "good." A model that meets all four
criteria above may still produce code that is:

- Inefficient compared to what a better model would generate
- Missing edge cases that a more careful model would catch
- Following outdated patterns when a more modern model would choose
  better ones
- Lacking the architectural insight that comes from deeper reasoning

This is not a criticism of Copilot's model selection. It is a description
of what the model selection *optimizes for*. And that optimization is
cost, not quality.

## The non-programmer problem

This is where the problem becomes most visible: when you are not a
programmer.

If you are a programmer, you can recognize mediocre output. You can spot
the inefficiencies, the missing edge cases, the outdated patterns. You
can judge the quality of Copilot's output because you have the skills to
do so.

If you are not a programmmmer, you cannot make that judgment. You accept
Copilot's output because it looks like code and because it looks
reasonable. And because the orchestrator is optimizing for cost, not
quality, the output you receive is often "so-so" — functional, but not
optimal.

The result is a false sense of productivity. You are getting code, but it
may not be *good* code. And you have no way to know the difference.

## The specific model question

If quality matters, the solution is simple: use a specific model, not an
orchestrator.

Run Claude directly. Run Codex directly. Run DeepSeek directly. When you
control which model processes your request, you control the quality
level. You can choose the best tool for the job, rather than accepting
whatever the cheapest tool happens to be.

This is what OpenSpec Workbench does: it lets you name a specific model
for each stage of your workflow, with specific quality constraints and
budget ceilings. You decide which model handles which task. The
orchestrator does not decide for you.

## The economics

Copilot is $10/month. The models it runs are billed separately through
their respective vendors. But the specific models chosen are typically
the lower-tier options — the ones that are cheap to run but not the
best quality.

A user who runs Claude Opus directly for their propose and review stages,
and DeepSeek for their apply stage, spends more per month but gets
significantly higher quality output. The per-change cost may be similar,
but the quality of each change is higher.

This is the trade-off that Copilot obscures: it makes you think you are
paying $10/month for good coding assistance, when in reality you are
paying $10/month for a system that selects the cheapest model for each
task.

## What this means for you

If you use Copilot, understand what it is: an orchestrator, not a model.
Understand that its model selection is biased toward cost, not quality.
And understand that if quality matters — and in professional development,
it always does — you will get better results by selecting your models
directly, rather than delegating that choice to an orchestrator with
different incentives.

The next article in this series will cover the practical model selection
strategy for OpenSpec workflows — which models to use where, and why.

## Try it

OpenSpec Workbench is a VS Code extension and a local web application, both over
the same core. There is a short tour of it in
[Supervise the agents that build your OpenSpec changes](https://openspec-ui.dev/articles/supervise-agents-on-openspec-changes/).
The code and the issues are at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

## Where each claim comes from

- Copilot's orchestration architecture: the
  [README](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/README.md),
  "Agent Selection" section, and public documentation of Copilot's model
  routing.
- That Copilot uses GPT-5.3-Codex for coding: public information about
  GitHub Copilot's model selection, read 2026-11-01.
- The cost-bias claim: this article's own assessment, based on
  observing Copilot's behavior across multiple usage patterns.
- The OpenSpec approach to model selection:
  [HARNESS.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/HARNESS.md),
  "`stepAgents`" and the agent capability table.
- Copilot Pro pricing: GitHub's own announcement,
  read 2026-11-01.

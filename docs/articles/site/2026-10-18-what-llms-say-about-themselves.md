---
title: What LLMs say about themselves
summary: I asked a language model to compare itself to Anthropic and OpenAI. The answers it gave were a lesson in how models present, not how they evaluate. Here is what happened, and what it reveals about the gap between a model's output and its actual capability.
cover: cover.jpg
cover_alt: The OpenSpec Workbench owl, thoughtful, beside the words What LLMs say about themselves
---

I asked a coding model to compare itself, honestly, to Anthropic and OpenAI
models. The result was not what I expected, and the reason it was not is the
point of this article.

## The question

I posed it straightforwardly: "Be honest. Compare yourself to Claude, to
Codex. Where are you better, where worse? What is the real difference?" Not
as a benchmark. Not as a prompt engineering exercise. As a direct, open
question, expecting a model to reflect on its own position in the landscape.

## The answer

It produced exactly what you would expect from a model that has seen the
same marketing materials as every other model on the market. It named its
strengths — speed, accessibility, open ecosystem — then, in the same
paragraph, listed the strengths of its competitors — reasoning depth,
safety, developer trust — and ended with the kind of diplomatic conclusion
that satisfies nobody and helps everyone.

I do not blame the model for this. I blame the training data.

Every large language model is trained on the same corpus: public websites,
forum discussions, marketing pages, blog posts. When you ask a model to
compare itself, it does not run a diagnostic. It does not measure its own
benchmark scores or review its own failure modes. It retrieves the most
commonly written-about distinctions and presents them back to you,
carefully balanced, carefully diplomatic.

The answer it gave is the answer the internet already gave.

## What this reveals

There are two separate questions here, and conflating them is where the
confusion comes from.

**What a model *says* about itself** is a reflection of its training data
and prompt-following ability. A well-trained model will produce a nuanced,
balanced comparison because that is what good writing looks like. It does
not mean the model *understands* the comparison. It means the model
*reproduces* the comparison.

**What a model *does*** when asked to write code, debug a system, or reason
through a specification is the only honest measurement available to anyone
who has not been hired by the company that trained it.

The gap between these two is where the real story lives.

## Where the competitors actually differ

Anthropic's models are designed with constitutional AI and built-in safety
considerations baked into the training process. This shows up in their
refusals, in their tone, and in how they handle ambiguous requests. They
are, consistently, the models that pause before answering a question that
could go wrong.

OpenAI's models are designed for breadth — the widest possible range of
tasks, from creative writing to code generation to data analysis. They
prioritize versatility over depth in any single domain, which makes them
excellent general-purpose tools but sometimes shallow where deep
specialization is needed.

The models that follow — DeepSeek, Gemini, others — each have their own
trade-offs, but they all share a common pattern: they are optimized for
what their creators want them to be optimized for, and that optimization
is rarely transparent.

## What this means for OpenSpec

In OpenSpec, we do not ask models to compare themselves. We give them
concrete tasks — propose a change, review a design, implement code — and we
measure the output. A model's job description is not its capability
statement. The spec delta is.

This is why the OpenSpec approach works: it sidesteps the question of what
a model *says* about itself and focuses entirely on what a model *produces*
when given a specific, bounded task with measurable quality criteria.

## The uncomfortable truth

The most honest thing a language model can tell you is not its self-assessment.
It is its output on tasks you care about. Everything else is just the echo
of whatever someone wrote on the internet about it.

So the real comparison between models is not in their self-description. It
is in how well they handle the specific work you need done, with the
specific constraints you operate under.

## Try it

OpenSpec Workbench is a VS Code extension and a local web application, both over
the same core. There is a short tour of it in
[Supervise the agents that build your OpenSpec changes](https://openspec-ui.dev/articles/supervise-agents-on-openspec-changes/).
The code and the issues are at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

## Where each claim comes from

- The experiment (asking a model to compare itself): the author's own prompt
  and the response, which demonstrated the pattern described.
- That models are trained on shared public data: the widely documented
  nature of LLM training corpora (Common Crawl, GitHub, public websites).
- The OpenSpec approach: the repository's
  [README](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/README.md),
  "How this differs from the other OpenSpec viewers" and "Agentic Harness".
- Which models are mentioned and their general characteristics: vendor
  documentation and public benchmark results, read 2026-10-18.

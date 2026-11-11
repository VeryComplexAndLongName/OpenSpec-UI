---
title: What one run actually spent
published: false
description: A run can call an agent several times. Workbench counts the recorded calls and shows how much of their cost was reported.
tags: openspec, devtools, observability, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/what-one-run-actually-spent/cover.png
canonical_url: https://openspec-ui.dev/articles/what-one-run-actually-spent/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/what-one-run-actually-spent/).*

A change goes through propose, review, and apply. Apply fails once and the harness retries it. The operator sees one run on the board. The agents made four calls.

An older usage report grouped records by the chain's `runId` and kept the first usage report for that ID. In this example, a report from propose could hide the other three calls. The run ID was right for finding or controlling the chain. The accounting needed an identity for each call.

## Count the calls that ran

Every recorded agent invocation can now carry its own `invocationId`. A stage and its retry can share a run ID and appear separately in the usage report. The report still gives a logical run count, so the example can show one run and four measured invocations when all four agents report usage.

Older audit records remain readable. Workbench pairs legacy start and terminal records in recorded order and retains repeated usage reports. It also counts invocations without measured usage, which is useful when a run mixes agents with different reporting capabilities.

## Read the coverage next to the amount

Suppose two calls reported dollar amounts of $0.02 and $0.00, and two reported tokens only. The recorded total is $0.02, with dollar coverage for two of four measured invocations. A reported zero counts toward coverage. When every call omits dollars, the text says `USD not reported` and JSON omits that amount.

Input, output, cache-read, cache-creation, and thought tokens have separate fields. The audit also records the model requested by the stage when it has one. Model totals use the figures the agent returned. Codex ACP 2.2.2 attributes a prompt's tokens to its current model, so a report marks that attribution when it applies. A run that switched models may still lack an exact split.

## Look up a change after archive

The report reads retained repository audit records for an active or archived change. If the change's worktree has been removed, a retained record can still contribute. An archived change can also be named by its unique dated archive name. The report's coverage depends on the logs that survived rotation and cleanup.

```bash
openspec-ui-cli show cost my-change
openspec-ui-cli show cost my-change --format json
openspec-ui-cli show run <runId>
```

Start with the invocation count and coverage before comparing two runs. If a retry explains the difference, `show run` gives you the recorded calls and their requested models. [ADR 0053](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0053-usage-is-accounted-per-invocation.md) records the accounting rules.

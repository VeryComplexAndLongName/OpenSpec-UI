---
title: Two things nobody was watching
summary: A 54 MB leftover that survived a whole day of cleanup passes, and a context window nobody was reading until DeepSeek's own agent told us how full it was.
cover: cover.jpg
cover_alt: The OpenSpec Workbench owl, eyes closed, beside the words Two things nobody was watching
---

OpenSpec Workbench's whole pitch is watching an agent while it works. Two
small fixes this week are about the product not watching itself closely
enough - one where cleanup quietly stopped, one where a number was arriving
the whole time and nothing was reading it.

## The leftover that survived being asked twice

A working directory is removed in two steps: git forgets it, then whatever
git left is deleted. Where the second step meets a file a live process
still has open, the deletion fails, something is left behind, and nobody
ever looks again - every later pass walks the directories git lists, and
git has already forgotten this one.

That is not a hypothetical. A shell from an already-archived change,
`a-change-knows-its-stage`, sat under the worktree root from one day to the
next: 54 megabytes, holding nothing but a downloaded copy of VS Code under
`packages/extension/.vscode-test`, which the extension's own test run had
been holding open at the exact moment something tried to remove it. Asked
again a day later, it went without complaint - one retry was all it ever
needed.

Two things had kept that retry from happening. The rule for "is this ours
to delete" was emptiness: a shell holding no file at any depth was cleared,
and anything else was left alone, on the reasoning that a directory with a
file in it belongs to someone. But a half-finished removal leaves exactly
the opposite - the files that could not be deleted are the ones still
there, so the rule excused the one case it existed for. And almost nothing
called the cleanup in the first place: it ran from a button in the
standalone app, and the periodic sweep that both hosts already run for
everything else never called it at all.

The fix changes what "ours" means: a shell named after a change this
repository knows, with no `.git` of its own, is cleared whatever is inside
it - what is in a directory says nothing about whose it is; its name and
the absence of a checkout do. The periodic sweep now clears these itself,
on every pass, and says what it removed and what it is still waiting on. A
shell it cannot clear yet is asked again next time, not forgotten.

Checked live against the real worktree root this repository uses: 320
known change names, two live working directories, one shell from an
archived change planted holding a file under `.vscode-test`. Read correctly
as not empty and ours, removed, with neither live working directory
touched.

## The number that was arriving the whole time

DeepSeek's CLI reports no cost, no credits, no token split - the answer to
"how do we put a spending ceiling on it" turned out to be "you can't; only
a time limit binds it at all." But it does send one figure over the Agent
Client Protocol: `usage_update`, carrying how many of the model's window
tokens the session is using right now. That figure was already arriving.
Nothing was reading it.

It is a strange number to build a ceiling on, and the reasoning for
leaving it alone still holds: it falls after a compaction, so counting it
as spend would under-count exactly the long runs that compact. But it
says something a spending figure never could, and says it while a stage is
still running rather than after: a session that has filled most of its
window makes every further turn carry the whole conversation again -
slower, more expensive, and worse at the task than the same work started
fresh.

`budget.maxContextShare` is a share of the window - `0.8` for eighty
percent - and reaching it now ends the run as cancelled, not failed, the
same way a time limit already does: a ceiling doing its job is not a
defect. A value outside `(0, 1]` is refused up front, so someone who means
eighty percent and types `80` is told rather than handed a ceiling that
could never fire.

Checked live: a chain running `deepseek-cli-acp` with the ceiling set
absurdly low. On this project's own pinned Node version, `dsh` refused to
start at all - the Node-version problem [an earlier article](https://openspec-ui.dev/articles/a-new-agent-and-nothing-else-moved/)
already found, showing up again in a different feature. On Node 24.18, the
run's first reading arrived, and the stage stopped mid-run with a reason
naming exactly what happened: "stopped at the context ceiling:
`budget.maxContextShare` is 0.0%, and the agent reported 8,277 of
1,000,000 tokens in its context (0.8%)."

The product also now knows, and says, which agents this can even work on.
`contextGauge` is a separate question from whether an agent reports
spending: `"none"` where that is certain, `"sends"` for `deepseek-cli-acp`
from this measurement, `"unknown"` for every other ACP agent nobody here
has watched yet. A stage this ceiling can bind is no longer listed as
unbounded - and one it cannot bind still says so honestly, rather than
implying a safety net that was never there.

## The pattern, twice

Neither of these was a code path that ran and did the wrong thing. Both
were something already true - a file still open, a number already
arriving - that nothing had been asked to look at. The fix, in both cases,
was smaller than finding the gap.

## Try it

The code is at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

## Where each claim comes from

- The leftover shell, the rule that excused it, and the fix: the archived
  change
  [`the-sweep-comes-back-for-what-it-left`](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/openspec/changes/archive/2026-09-23-the-sweep-comes-back-for-what-it-left/proposal.md),
  and its own `tasks.md` for the live numbers (320 known change names, the
  54 MB find).
- The context ceiling, the live cancellation message, and the Node-version
  refusal: the archived change
  [`a-run-can-outgrow-its-context`](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/openspec/changes/archive/2026-09-23-a-run-can-outgrow-its-context/proposal.md)
  and its `tasks.md`.
- `maxContextShare`, why it is not counted as spend, and `contextGauge`:
  [LIMITS.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/LIMITS.md),
  "caps how full the context gets" and the `contextGauge` section.

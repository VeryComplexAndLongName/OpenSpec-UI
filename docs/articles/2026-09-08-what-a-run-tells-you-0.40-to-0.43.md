# What a run tells you: OpenSpec Workbench 0.40 → 0.43

Four releases, and one theme running through all of them: an agent that
spends your money and your time should be able to say what it is about to
do, what it cannot do, and why it stopped.

That sounds obvious. Most of the work in these four releases was
discovering how many places it was not true.

---

## 0.40 — the run that waited forever

An agent asked for permission mid-chain. The chain had no way to answer.

`HarnessChainRunner` routed `cancel` to the runner executing the stage in
flight, but not `resolvePermission` — that command was rejected as
non-chain, so the request sat on a promise nothing could resolve. The run
did not fail. It did not time out. It waited.

0.40 routes the answer the same way `cancel` was already routed, and both
hosts gained the matching branch. The chain panel gained Allow/Deny.

And the case underneath it: a permission request raised at
`autonomyLevel: "autonomous"`, where there is no one to ask by
definition. That now fails the stage with a stated reason and ends the
process, instead of waiting on a channel that does not exist.

**A run that hangs is worse than a run that fails**, because failure is
information and hanging is not.

---

## 0.41 — finding a change in the other view

Small, and about the same thing at a different scale. "Reveal in Change
Graph" and "Reveal in Changes" connect the two views; a setting reveals
the graph automatically as the selection changes.

Two details are the point. A change with several rows expands and selects
**every one of them** and says how many — not the first, silently. And a
change that states no relation is **reported as such**, rather than
appearing to do nothing.

"Nothing happened" and "there is nothing to show" look identical on
screen. They are not the same fact.

---

## 0.42 — limits that can actually act

The largest release of the four, and all of it one argument.

### A run can be bounded in time

`timeout.maxRunSeconds` and `timeout.maxStageSeconds` cap a chain and a
single stage. Both optional, absent means unbounded, settable globally
and per change.

Unlike a spending ceiling, **this one can stop a stage that is already
running**. Elapsed time is known during a run; a run's cost is not known
until it ends. That asymmetry decides where each ceiling can act.

It is also the only ceiling with any force over an agent that reports
nothing. Of the ten supported agents, **six report no usage at all**:
`claude-cli`, `copilot-cli`, `codex-cli`, `gemini-cli`, `local-llm` and
VS Code Chat. One reports tokens without cost. One reports both. Two have
never been observed. Before 0.42, no ceiling of any kind was in force
over the six.

Time counts while a stage runs and not while the chain waits at a
checkpoint. A person deliberating is not a run consuming anything.

Reaching a ceiling ends the run as **cancelled with a reason naming the
ceiling and its configured value**, not as a failure. An absent reason
still means "a person asked" — which is the distinction that makes the
field worth having.

### Settings say what they cannot do

A ceiling could be configured, saved, accepted by validation, and never
fire. A cost ceiling over an agent that reports no cost. A token ceiling
over an agent whose tokens are almost entirely cache. Any spending
ceiling over those six agents.

The configuration looked correct. It was accepted. It did nothing.

0.42 reports these — the ceiling set below what a single stage costs, the
one set so high nothing reaches it, the agent that reports no spend at
all — and it says so **where the configuration is edited**, and, since
0.43, **before the run starts**.

### Configurations by intent

Three named configurations — **Minimum cost**, **Balanced**, **Fastest** —
each carrying what it is for, when it is the wrong choice, and where each
number came from. They are titled by what a person is actually choosing
between, with the ceilings in the title rather than three lines down:

![The per-change settings section, with the three templates and the
stage controls below them](../images/standalone/harness-change-override.png)

Every ceiling in them is drawn from this repository's own audit log,
measured on 2026-09-08: **49 runs with a recorded duration** — median 7.7
minutes, p75 19.7, p90 34.9, longest 56.8 — and **16 with a recorded
cost**, median $1.94, p90 $7.14, largest $8.67.

That last pair of numbers is why a stage ceiling of twenty minutes is p75
and not the round ten minutes a person reaches for. Ten would have cut
nearly a third of the runs that completed normally.

Where a value is judgement rather than measurement, the template says so.
Four hours and $25 are not in the data.

A test asserts that **every template produces no findings** — that every
ceiling it sets can act on the agent it names. That check is what
separates a template from a suggestion.

### A recommendation, with its grounds

Which of the three suits this change? The plan said "suggest a budget
from what comparable changes cost". Measuring the history that would read
said it cannot be done honestly: of 22 changes carrying any record,
**13 have exactly one run and 16 have no run that reported a cost**.

A per-change figure drawn from that is arithmetic wearing the costume of
evidence — and it would be believed, because it looks computed.

So it recommends a named configuration and never a number, and the
observations travel with the answer rather than being available on
request. A recommendation whose reasons are hidden can only be accepted
or ignored, never disagreed with — and the cases a reader would argue
with are exactly the ones where it is worst.

---

## 0.43 — one way in

There were two menu entries for starting work on a change, and which one
you wanted was not answerable from their names.

**Run with Agentic Harness** read the change's configuration and opened
the panel it pointed at — showing nothing of what it had read.
**Implement with VS Code Agent** ignored the configuration entirely.

So the choice you actually face — *who does this work, and how much of it
without me* — was spread across two entries and a file that one of them
never consulted. Picking wrong was not visibly wrong: on an `assisted`
change, the first looked like it only changed tabs.

0.43 replaces both with one entry, named **Run**, that shows the decision
before making it:

![The Run dialog: the resolved path, the setting it read, each stage's
agent, and the ceilings that cannot act](../images/standalone/run-dialog.png)

Read what that picture actually says. The chain will run, because
`autonomyLevel` is `semi-autonomous` — the setting is named, not implied.
`review` has **no agent set**, said outright rather than left off the
list. Three ceilings cannot act, because `claude-cli` reports nothing for
a spending ceiling to compare against and no timeout is configured. One
named configuration is recommended, with the observations behind it —
including that there is no previous run to go on. And all three can be
applied from the same place.

None of that was visible before starting a run. Some of it was not
visible at all.

The first version of this dialog shipped without most of it, and was
reported — fairly — as "just a path picker". It never advised in the
standalone shell, on a recorded ground that turned out to be half untrue;
it buried the editor's recommendation in a hint that truncates; it named
a configuration and gave no way to apply it; and when nothing was wrong
it said nothing at all, which makes "examined and fine" look exactly like
"not examined".

Which is the same mistake it was built to fix, committed by the thing
fixing it. That is worth saying plainly rather than quietly correcting.

Choosing a path other than the configured one applies to **that run
alone** and writes nothing. A run is not a configuration change, and a
later run behaving differently for a reason nobody recorded is worse than
being asked again.

The VS Code agent is now a choice inside the dialog rather than a second
entry. It was never a separate way of working: `vscode-chat` is already a
step agent, so that path is the `apply` stage run by it. It looked
separate only because it had its own command.

---

## What the live checks found

Every change in this project carries items a machine cannot close —
open the thing, use it, and say what you saw. Over these releases those
items found four defects that no test caught, and they share a shape.

**The templates saved nothing.** The settings view sent two of the eight
accepted configuration keys, and the writer replaces the file. So every
ceiling a template exists to set was deleted on save — while the panel
updated correctly and the message truthfully said "nothing is saved until
you save".

**The unattended template promised what it did not do.** Its text said "No
checkpoints between stages" and its configuration never set that. Nothing
compared a template's sentences against what it applies.

**Verify could not send work back.** The backward edge from `verify` to
`apply` exists, by its own comment, because a failing mechanical check is
the clearest statement that earlier work is unfinished. But the gate that
runs those checks returned `failed` before the loop ever reached the
edge. The one case it was written for was the one case it could not
reach.

**A ceiling's reason never reached the log.** The panel showed why a
stage was cut. The audit entry did not — so in the persisted record, a
run stopped by a rule was indistinguishable from one a person cancelled.

Four different defects, one shape: **the visible half was right and the
acted-upon half was not.** A test looking at the visible half passes
every time. The only thing that catches this is opening the file that
came out and reading it.

Even the screenshot above earned its keep that way. Captured for this
article, it showed the agent list and the ceiling list rendering as one
undifferentiated run of bullets — a legibility defect that no assertion
would have reported. The headings in the picture are there because
someone looked at the picture.

---

## What still does not work

- **`semi-autonomous` and `autonomous` are labelled "not yet
  implemented"** in the settings view, and the label is honest.
- **Two of the ten agents have never been observed reporting usage** —
  `codex-cli-acp` and `gemini-cli-acp`. Their entries say `unknown`
  rather than guessing.
- **Per-task configuration does not exist.** The unit of a run is a
  stage, so an agent assigned to a task would be a setting nothing reads.
  Making a task section its own run comes first.
- **The recommendation cannot be exercised by this repository's own
  history.** Run over all 22 changes in the audit log it answers the same
  thing for every one — because every change with a record is archived
  with zero open tasks. That is the corpus, not the recommender, and it
  is recorded as a limitation rather than reported as a pass.

---

## The thread

Across four releases the same sentence keeps being the fix: *say what you
read, say what you cannot do, and say why you stopped.*

A ceiling that cannot act is worse than no ceiling, because it reads as
protection. A recommendation without grounds cannot be argued with. A run
that hangs tells you less than one that fails. And a menu entry named
after one of three things it does is how a second entry, named after
another, comes to look reasonable.

None of that is about agents being smarter. It is about a tool being
answerable for what it is doing with your money.

---

*OpenSpec Workbench 0.43.0 — a dashboard and VS Code extension for
OpenSpec, with Claude, Copilot, Codex and Gemini agents built in. Every
screenshot here is captured from the running product by an end-to-end
test, on the commit it illustrates.*

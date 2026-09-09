# What a run tells you: OpenSpec Workbench 0.40 → 0.44

Five releases, and one theme running through all of them: an agent that
spends your money and your time should be able to say what it is about to
do, what it cannot do, and why it stopped.

That sounds obvious. Most of the work in these five releases was
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

Four named configurations — **Thorough**, **Careful**, **Balanced**,
**Economy** — each carrying what it is for, when it is the wrong choice,
and where each number came from. They are named by the one thing the
product can set honestly: how much effort the agent is asked for.

![The per-change settings section, with the named configurations and the
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

0.43 replaces both with one entry, named **Run**. What it was meant to
show, and what it took 0.44 to actually show, is this:

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

Choosing a path other than the configured one applies to **that run
alone** and writes nothing. A run is not a configuration change, and a
later run behaving differently for a reason nobody recorded is worse than
being asked again.

The VS Code agent is now a choice inside the dialog rather than a second
entry. It was never a separate way of working: `vscode-chat` is already a
step agent, so that path is the `apply` stage run by it. It looked
separate only because it had its own command.

---

## 0.44 — finishing what 0.43 claimed

0.43 shipped the entry above and it did not do most of what this article
would have said about it. Opened, it offered three buttons.

It never advised in the standalone shell — on a recorded ground that the
browser "can read neither the task list nor the audit log", half of which
was never checked: the task list has been available over HTTP the whole
time. It buried the editor's recommendation in a quick-pick hint that
truncates, so the text was present and unreadable. It named a
configuration and offered no way to apply it, which makes a
recommendation a remark. And when nothing was wrong it rendered nothing
at all, so "examined and fine" looked exactly like "not examined".

Four faults, and every one of them is the mistake the entry was built to
fix — showing less than was known — committed by the thing fixing it.

0.44 is that finished. The recommendation appears in both hosts, with its
grounds beneath it. The named configurations are offered where the
choice is made, and applying one writes the change's file. A
configuration whose ceilings can all act says so.

### The configurations are named for the effort they ask for

They were Careful, Overnight and Thrifty — named for how closely a person
watches, which is a consequence of the choice rather than the choice.
Then they were named for their ceilings, with the figures in the title.
That was closer and still wrong: a title reading "up to $3" was read as
what the run would cost, and it is not a price. It is the point at which
a run is stopped.

So they are named for the effort now, and the figures stayed — with
where each came from — one line down:

| | |
| --- | --- |
| **Thorough** | highest effort; up to $25 and 4 hours, so a stage is not cut |
| **Careful** | above ordinary effort; up to $10 and 2 hours |
| **Balanced** | the middle of the agent's range; up to $5 and 60 minutes |
| **Economy** | the least the agent will do; up to $3 and 45 minutes |

Effort is the only dial that can be set honestly. Every agent declares
which values it accepts, so "the highest this agent takes" is always
expressible — and no agent lists its models, so **none of these sets a
model**. Whichever you configured is the one that runs. A named
configuration that overrode it would be discarding a choice nobody asked
it to make.

The vocabularies differ, which is why a configuration stores a *level*
and not a value. "Highest" resolves to `max` for Claude, `high` for
Codex, and to nothing at all for the five registered agents that take no
effort setting — where the four configurations differ in their ceilings
alone, and the dialog says so rather than showing a dial that does
nothing. The table of every agent against every level is in the change's
`design.md`; building it is what caught a spacing that put two
configurations on one value for Codex and left a third unreachable.

None of them turns the checkpoints off any more, either. The ceilings are
still worth a sentence: a stage cut at a ceiling is retried from the
start, so a **tight ceiling makes a run take longer**.

### Three defects, none found by a test

**A cancelled run left a timer armed.** `spawnAndStream` set a
ten-second kill-confirmation timer on abort and never cleared it, so a
cancelled CLI run held the Node event loop open that much longer after it
had finished. The lint rule had been saying so for days —
`'killTimer' is assigned a value but never used` — and the warning was
dismissed as pre-existing in every verification run recorded. The
variable exists to be cleared. That was the defect.

**Applying a configuration deleted the rest of one.** Both hosts wrote
the template as the change's whole file, and the writer replaces. So
`gitStageAllowlist` — which says which paths a chain may stage — was
removed by reaching for a cheaper run. Third occurrence of one defect in
this repository, and the first that was introduced rather than inherited.

**A source file was invisible to search.** A raw NUL byte sat inside a
template literal where the two-character escape was meant, almost
certainly from a shell heredoc. It compiled and it worked. What it broke
was `grep`, which classified the file as binary and skipped it silently:
a search for a term inside it returned nothing at all. A file no search
can reach is a file nobody reviews, in a repository that greps itself
constantly. There is a check for that now.

---

## What five defects have in common

Across these releases, five defects were found in this project's own
code. **None of them by a test.** Every one surfaced because someone
opened the thing that came out and read it.

| Found by | What it was |
| --- | --- |
| applying a configuration and reading the file | nothing was saved |
| reading a template's own text | it promised what it did not set |
| opening the dialog | it was a path picker |
| looking at a screenshot | two lists rendered as one |
| reading a grep result | a source file was binary |

One shape: **the visible half was right and the acted-upon half was
not.** The panel updated. The message was true. The tests were green. And
the file that came out was wrong.

A test that looks at the visible half passes every time. That is not a
gap in the tests, it is what tests are: assertions about what someone
already thought to check. The two habits that actually caught these were
opening the artifact and reading it, and treating a standing warning as a
statement rather than as noise.

Even the screenshot in this article earned its keep that way. Captured
for it, the first version showed the agent list and the ceiling list
rendering as one undifferentiated run of bullets — a legibility defect no
assertion would have reported. The headings in the picture are there
because someone looked at the picture.

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
- **The standalone shell cannot read the run history.** It reads how much
  work is left, which is enough to recommend from, and says outright that
  there is no previous run to go on. The editor reads both.
- **The editor's dialog is a quick-pick**, which gives one line per field
  and cuts the rest. Text that will not fit is now shortened deliberately
  rather than by the control, but a paragraph still does not fit. The
  standalone dialog has room for it; the editor wants a webview.

---

## The thread

Across five releases the same sentence keeps being the fix: *say what you
read, say what you cannot do, and say why you stopped.*

A ceiling that cannot act is worse than no ceiling, because it reads as
protection. A recommendation without grounds cannot be argued with. A run
that hangs tells you less than one that fails. And a menu entry named
after one of three things it does is how a second entry, named after
another, comes to look reasonable.

None of that is about agents being smarter. It is about a tool being
answerable for what it is doing with your money.

---

*OpenSpec Workbench 0.44.0 — a dashboard and VS Code extension for
OpenSpec, with Claude, Copilot, Codex and Gemini agents built in. Every
screenshot here is captured from the running product by an end-to-end
test, on the commit it illustrates.*

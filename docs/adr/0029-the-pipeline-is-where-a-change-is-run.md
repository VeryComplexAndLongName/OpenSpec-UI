# 0029: The Pipeline Is Where a Change Is Run

Status: Accepted

Date: 2026-09-13

## Context

ADR-0025 drew the order of the work as a picture. ADR-0026 added every
other working directory to it, read-only, and the first half of ADR-0028
had every run write down what it is doing, beside the repository. The
picture now answers "what is in flight". Nobody can do anything about it
from there, and several of the things it shows are only partly true.

On 2026-09-13 the owner asked for the Pipeline to become the place a
change is run: a change drawn as the thing being worked on rather than as
a label, with its tasks, what its run is doing now, and the controls to
start it, answer it and stop it — in the editor as well as in the
standalone shell.

What stands in the way, as read from the code on that date:

- **The picture exists in one host.** `PipelineView` is rendered only by
  the standalone shell. The extension has two webviews, the AI panel and
  the one-shot timeline, and neither shows it; nothing in the extension
  reads readiness or the survey at all.
- **A change being worked on is drawn twice, or not as running.**
  Readiness reads the changes of this checkout, and calls a change running
  only when a lease holds the working directory ADR-0022 made for it. A
  change running in its own worktree is therefore a card here saying
  `running in <path>` with no progress, and a second card under that
  worktree carrying the ticks its agent is making. A run in this checkout
  with no worktree is never called running, although its status record
  says it is.
- **A card knows nothing about a run's history or a change's tasks.** No
  core function answers "how did this change's last run end". The audit
  log has an entry per stage, and a chain cancelled at a checkpoint, or
  stopped by its time or attempt limit, writes no entry for that ending. A
  local card carries no task counts, and no code anywhere names the task a
  run is on.
- **A run can be controlled only from the panel that started it.** Its
  run id lives in that panel. A chain paused at a checkpoint is invisible
  anywhere else: the pause is held in memory, and the status record goes
  on saying `running <stage>`. A run started by another process cannot be
  stopped at all, which ADR-0028 left to its second half.
- **A card has a fixed size** (ADR-0025). It holds a name, a state and two
  lines, not a list of tasks.

## Decision

**The Pipeline is one tab, in both hosts, drawn by one component.**

In the editor it is a webview panel of its own, rendering the shared
`PipelineView`. ADR-0003 reserves a webview for "process visualization
and controls that have no equivalent native VS Code surface", and this is
that. The Change Graph tree states relations; a tree has no columns, no
activity and no controls. The tab does not replace the tree.

Its readings come from direct core calls over the message bridge, the
default ADR-0001 set; no local server is started for it. Files, not a
clock, decide when it reads again while the tab is visible:

- a change under `openspec/changes` re-reads the picture;
- a change in the status directory re-reads the records, which costs file
  reads and no subprocess.

Ages such as "said so 40 seconds ago" are counted in the view from the
timestamps a reading carries. A heartbeat that renews a record therefore
changes nothing on screen until the words change. A slow re-read remains
for what changes without a file event: git's list of working directories,
and a record or a lease going stale.

The standalone shell keeps polling. Pushing readings to it would need a
subscription its transport does not have, and that is not decided here.

**A change is one card, wherever it is being worked.**

A card shows a change of this checkout. ADR-0022 gives a change a
worktree of its own, on a branch named after the change, and core already
recognises it. Where that worktree exists, whether or not anything runs
in it yet, the card's tasks, its task in hand and its run are read from
it, and the card names the directory each fact came from. That directory's part of the survey does
not draw the change a second time.

This keeps ADR-0026's identity rule rather than bending it. A change is
still the pair of a directory and a name, and the card says which
directory it read. The pairing is not a coincidence of names: it is the
one directory this product creates for exactly that change.

A run whose status record names the change, in this checkout or in the
change's own worktree, makes the card say the change is running, whether
or not a lease holds anything. The lease says who holds a directory; the
status record says what is being done in it (ADR-0028). The card needs
the second.

**What a card says is derived in core, in words.**

One function in core turns the readiness report, the survey, the status
records, the task lists and the audit log into what each card says, and
the command line can print the same thing. The shell renders it and
computes none of it, for the reason ADR-0025 gave for putting the layout
in core: two implementations of one answer drift apart, and both look
plausible.

A card states:

- **Its state**, as one word from a closed set: Running, Waiting for you,
  Failed at a stage, Stopped at a stage, Blocked, Ready, Done. What is
  happening now outranks how the last run ended, which in turn outranks
  what could happen next.
- **The stage and activity** of a run under way, and how long since the
  run said so.
- **Its task progress**: done out of total, and how many open items only a
  person or another agent can close.
- **Its last run**: where it ended, when, and what it cost.
- **The directory and branch** its facts were read from.

A word never claims more than the facts support. "Waiting for you" is
said only where the answer can be given from this card; a run waiting
somewhere else is described as waiting, and the card says where.
"Stopped" is not "Failed": a person's stop is not a fault, and a reader
deciding whether to look into a run should not have to open it to find
out which it was.

The last run is read from the audit log, grouped by run across every
working directory's log. A chain's own ending is therefore written there
too, including a cancel at a checkpoint and a stop by a time or attempt
limit. A history that records only stages cannot say where a chain
ended.

The status record gains three things the card needs and cannot read
anywhere else: the task in hand, whether the run is waiting and for what,
and the run's id. It still describes only the present (ADR-0028); what a
run did goes to the audit log as it happens.

**The task in hand is what the agent says, or a guess labelled as one.**

The implementing instruction tells the agent to print, before it starts a
task, one line of a fixed form that names the task's number. Core reads
every completed line of the agent's own reply, but neither its reasoning
nor a tool's output. It writes the latest such number into the status
record at once, in a field of its own, apart from the activity line that
the next line of output replaces within a second. A number that names no
task of the change is ignored rather than shown. A delegated run knows
its task before it starts, and records it from the command.

Where no marker has come, the card shows the first open task an agent may
do, and says that it is a guess: "probably 2.3". A guess worded as a
report would be believed.

The marker is best-effort, and is described as such. It can be seen only
from an agent whose reply reaches the host while it works. An agent that
delivers its reply when it finishes shows the guess until then. Which of
the registered agents deliver it while working is established by running
them, not assumed.

**A card opens to its tasks, and every line says what it means.**

Opened, a card lists its tasks in the order of `tasks.md`, under that
file's section headings, each with its state in words: done, in hand,
probably next, open, only a person can close it, or delegated to a named
agent.

A thin line joins each task to the one listed after it, and means exactly
that: listed next. The solid line between cards is still a declared
`blocked_by`, and nothing else. A legend states both. A collision is
still text on the card and never a line (ADR-0025). Dependencies between
tasks are not drawn: `tasks.md` has no way to declare one, and an
inferred dependency would be believed like a declared one.

**A card's size is derived from what it shows.**

This amends ADR-0025's fixed size, and keeps its rule that nothing is
measured. A closed card has today's size. An open card's height is that
size plus one row for each heading and task, from size tokens in core, as
a card's line budget already is. A column stacks its cards by their
heights. An edge attaches at a card's head, which does not move when the
card opens.

Zoom is one unitless factor that multiplies the unit and the card's type
sizes together. A factor resolves the same on every element, so the
reason ADR-0025 chose `rem` still holds. Heights and lines scale
together, so the number of lines a card holds does not change with zoom.
The factor, and which cards are open, are remembered per viewer.

**The card carries the controls, and each one reaches the run itself.**

A card becomes a group of controls, because a button cannot contain
buttons: its name, which opens the change; a disclosure for its tasks;
and its actions.

- **Start** opens the run dialog for that change, and is offered only
  where the change can start. A blocked change cannot be started by
  asking from a different place.
- **Answer.** When a run this host started is waiting at a checkpoint or
  on a permission, it is answered on its card. The host keeps the runs it
  started in one registry in core, by run id and by change, so an answer
  reaches the run rather than whichever panel happened to launch it.
- **Stop** is ADR-0028's request, and the word means one thing on every
  card. The run stops at the next point where the work is sound: at once
  if it is waiting, otherwise when its next task is ticked or its stage
  ends, whichever comes first. It says in its status that it was asked to
  stop, by whom, and why; a reason is asked for.

  For a run this host started, the card also offers **Stop now** once a
  stop has been asked for. That is the termination the run panel's Cancel
  already performs.

A run elsewhere is reached only through ADR-0028's signed channel. Stop
is offered on its card only once a signature shows that the run belongs
to this person; until signatures exist, Stop is not offered for runs
elsewhere at all. Nothing else is offered for such a run. A checkpoint
elsewhere is answered where the run was started. The card shows the path
of the folder the run was started in, with a control that copies it, and
no control that opens that folder or starts anything in it.

**What an agent wrote is shown as far as it is held.**

For every run, a card shows the last line the run said, from its status
record. For a run this host started, the card opens the full output,
which that host already holds. For a run elsewhere there is no output to
open. A per-run log beside the status record would be history, which
ADR-0028 keeps out of that directory; whether to add one is left to a
decision of its own.

## Consequences

The editor and the shell show one picture, in the same words, from one
core function, and the terminal can print those words too.

A change being worked on in its own worktree is one card with its real
progress, and a run holding no lease is visible as running.

A chain paused at a checkpoint says so wherever it is read, instead of
looking like a stage in progress.

The status record grows by three fields and remains a record of the
present. A reader that does not know the new fields ignores them.

A stop from a card is gentler by default, and slower: it may wait for a
task to be ticked. For a run this host started, Stop now remains. For a
run elsewhere, the wait is the price of not ending a process across a
boundary this system does not control.

Stop for runs elsewhere depends on ADR-0028's signatures.

The decision is implemented in changes, in this order:

1. The tab in the editor, and the task a run is on, as two independent
   changes.
2. What a card says.
3. The controls on a card, and a card's tasks.
4. Asking a run elsewhere to stop, after both the controls and
   signatures. Signatures depend on none of the changes before them.

## Amendment, 2026-09-13: one word for a change, on every surface

ADR-0026's amendment of the same day has every surface that lists changes
say where a change stands across the repository. This ADR has a card say
what its change is doing. Written separately, those would be two sets of
words for one change: a card saying "Ready" beside a Changes tree saying
"Archived on main". The owner stated the rule on 2026-09-13: changes look
the same, and carry the same state, in the Changes view and on the card —
everywhere, so that nothing misleads anyone.

**A change has one state word, from one closed set, derived by one core
function.** The Changes tree, the standalone Changes list, a Pipeline card
and the terminal all show that word, and none of them derives its own. The
set, in order of precedence:

1. **What is happening now.**
   - **Running**, or **Running in `label`** when the run is elsewhere.
   - **Waiting for you**, where the answer can be given from here, or
     **Waiting in `label`**.
2. **What has been settled elsewhere.**
   - **Archived on main**
   - **Merged in #N**
   - **Deleted on main**
3. **Where the work is ahead elsewhere.** **Further along in `label`**, or
   **on branch `name`**.
4. **How the last run here ended.** **Failed at `stage`**, or **Stopped at
   `stage`**.
5. **What can happen next here.**
   - **Done**: every task is ticked here.
   - **Blocked**
   - **Ready**

The first that applies is the word. Whatever else applies is stated in the
lines beneath it, each naming its source. For example, a change that is
Ready here can also have a last run that failed, or be behind another copy.

**Colour agrees with the word, on every surface alike.** Settled elsewhere
is light green, ahead elsewhere is yellow, now is blue, failed or stopped
is red, and deleted is grey. The word is always shown, so colour never
carries the state alone.

This replaces the list of words in "What a card says is derived in core,
in words" above, and the list in ADR-0026's amendment. The rules those
sections give for what a word may claim still hold. "Waiting for you" is
said only where the answer can be given here. "Stopped" is never
"Failed".

## Alternatives considered

**Tree views in the editor instead of a webview.** Rejected. The picture
is the order of the work, and a tree has no columns. The controls need a
run's live state beside them, which is what ADR-0003 reserved a webview
for.

**The local server's page as the editor's Pipeline.** Rejected. It would
put a server on the editor's default path, which ADR-0001 decided
against, and it would show what the standalone server sees, without the
runs the editor itself started.

**Guessing the task in hand from the last tick.** Kept as the fallback,
rejected as the answer. A tick says which task ended, not which one
began, and an agent that works out of order would be shown on the wrong
task with nothing to say so.

**A new event kind for the task in hand.** Rejected. Every transport
would carry it, and every contract test would cover it, for an event
whose only reader is the status record, which already reaches every
surface.

**The agent's own plan.** Rejected. It is the agent's list, not
`tasks.md`: its steps carry none of the file's numbers, and not every
agent sends one.

**Stop as termination.** Rejected as the card's default. It ends a run in
the middle of an edit, and across processes it would mean ending
somebody's process from a view. For the runs this host started, it
remains available as Stop now.

**Answering a checkpoint elsewhere.** Rejected. ADR-0028's channel
carries a request to stop. A request to continue would be an order to a
run that holds a lease while it waits, which is the pause ADR-0028
declined to offer.

**Opening a run's folder from the card.** Rejected. ADR-0026 offers
nothing that opens another directory's work. A server endpoint that opens
a file manager would be a new way to act on the machine, for a
convenience the copied path already gives.

**Measuring open cards.** Rejected for the reasons ADR-0025 gave, which
do not change when a card grows.

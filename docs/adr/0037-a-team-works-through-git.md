# 0037: A Team Works Through Git

Status: Accepted

Date: 2026-09-22

## Context

The product was built for one person supervising agents on one machine.
The repository already has a team, though: the owner, the agents that
run changes, and a second agent that prepares articles. Three questions
keep coming back, and the product answers none of them:

- Whose change is this, and who is doing it now?
- Why did it go back a step, and who sent it back?
- How long did it spend in each step, including repeated visits?

What the product knows today:

- **A change's state is derived, never declared** (ADR 0024, ADR 0025,
  ADR 0029). `describeChangeState` in `change-state-word.ts` reads one
  state word per change from files, git, pull requests and status records.
  Nothing records a lifecycle stage.
- **People are known by key, but only on one machine.** Each person has an
  Ed25519 key per machine (`machine-key.ts`). Status records and messages
  are sealed with it (`signed-envelope.ts`). The roster that maps a key to
  a person lives beside the repository, in `.agent-roster/` (ADR 0028), and
  is never committed. A colleague on another machine cannot verify a
  signature. A person with two machines has two keys, and nothing links
  them.
- **No person is recorded for an agent's work.** Audit entries and run
  logs have no person field. ADR 0028 says an agent works on its person's
  behalf and signs with that person's key, but no `onBehalfOf` field
  exists.
- **The repository knows order, not time** (ADR 0025). `change-dates.ts`
  has a proposed date, first and last worked dates, and an archived date,
  each with its source. Pull request times are not read: a forge answers
  only a number and a state (`BranchPullRequest`).
- **`openspec archive` moves only the documents it knows**
  (`workspace-leftovers.ts`). Anything else of ours stays in the old
  directory.

On 2026-09-22 the owner set the direction:

- team work, with no server and no database;
- git and the forge as the only shared truth;
- a board by the stages of a change, from planning to the merge into
  `main` and the archive;
- a Change Owner and a Change Implementer, who are always people, while
  their agents act for them and are seen to be agents;
- a change that can go back a step, with the reason recorded;
- a history that never disappears, and time counted in each stage;
- whatever is useful in any case goes into the core. A paid plugin,
  reports, policies, and a platform for other people's plugins come later,
  and only if people ask for them.

## Decision

1. **Two roles, both people.**
   - **The Change Owner** answers for the change. There is one at a time.
   - **The Change Implementer** does the work. There is one at a time, or
     none. The Implementer may do it by hand, or have agents do it.
   - An agent is never an Owner or an Implementer. It acts for a person,
     signs with that person's key, and every record of its action names it
     as an agent.

2. **People are in git.** Each person has one file,
   `openspec/people/<handle>.json`:
   - a `handle`, chosen by the person and unique in the repository;
   - a display name;
   - one public key per machine;
   - optionally, the git e-mail addresses that are theirs.

   Joining a team is a pull request that adds this file. A new machine is
   a pull request that adds its key. An e-mail address is optional, so a
   public repository need not publish one.

   A key is never taken out, only retired, with a `retiredAt` date, and a
   person's file is never removed. What a key signed has to keep verifying
   for as long as the history is kept, which is for good. The merge gate
   refuses a pull request that removes a person or a key, replaces a key,
   or changes a retirement already recorded.

   The roster beside the repository (ADR 0028) stays as it is, for live
   coordination. Enrolling on a machine may offer to write the person's
   file, so nobody types a key by hand.

3. **A change keeps its history in git, one signed file per event.**
   - Each event is a file in `openspec/changes/<id>/history/`, named
     `<UTC time>-<key id prefix>-<type>.json`.
   - The file is a signed envelope from `signed-envelope.ts`, unchanged.
   - Its payload says:
     - what happened;
     - when, as claimed and signed;
     - which person did it, by handle and key id;
     - whether a person or an agent acted, and for an agent, which agent
       and which run.
   - One file per event means two branches never edit the same file, so a
     merge never conflicts on history.

   The kinds of event are a closed list:

   | Event | Carries |
   | --- | --- |
   | `owner-set` | the new Owner's handle |
   | `implementer-set` | the new Implementer's handle, or none |
   | `sent-back` | the stage it goes back to, the reason, and each task item reopened with why |

   Stage changes are not events. A stage is derived (decision 5), so a file
   that declared one would be a second truth.

4. **History is only ever added to, and the merge gate says so.** The
   merge gate (`validate --change <id> --base <ref>`) refuses a change that
   does any of these:
   - edits or deletes a history file that is on the base;
   - adds a history file that does not check out;
   - adds a file signed by a key that is in no person's file on the head;
   - breaks the hand-over rules, which are rules of record, not policy:
     - only the current Owner hands the Ownership on;
     - the first `owner-set` may be written by anyone;
     - the Owner sets the Implementer;
     - the Implementer may set none, handing the work back;
     - the Owner or the Implementer sends a change back.

   The reason in a `sent-back` event is shown as plain text, and nothing
   ever runs it. Repository contents are data, not instructions.

5. **Stages are derived, from facts, in a closed list.**

   | Stage | Reached when |
   | --- | --- |
   | Proposed | the change has a proposal and no task items |
   | Planned | `tasks.md` has items, none closed, and no run or branch exists |
   | In progress | a task item is closed, or a run happened, and no pull request is open |
   | In review | its pull request is open |
   | Landed | its pull request merged, and it is not yet archived |
   | Archived | the default branch has it under `archive/` |

   A `sent-back` event puts the change in the named stage until a fact
   newer than the event moves it on: a push, a closed task item, or a
   merge. Being blocked, waiting for a person, and a failed run are flags
   on a card, not stages.

6. **Time in a stage is read from dated facts, each with its source.**

   | Stage | Entered at | Source |
   | --- | --- | --- |
   | Proposed | the first commit that adds `proposal.md` | git commit |
   | Planned | the first commit in which `tasks.md` has an item | git commit |
   | In progress | the first closed item, or the first run, whichever is earlier | git blame, audit log |
   | In review | the pull request's creation | forge |
   | Landed | the pull request's merge | forge |
   | Archived | the archive commit | git commit |

   Each `sent-back` event starts a new visit, so a stage may have several.
   The forge interface gains the pull request's creation and merge times,
   for GitHub (both ways), GitLab and Gitea. Where a source cannot be read,
   the interval says so, as `ChangeDates` already does, and nothing is
   guessed.

7. **The board is a view of the Pipeline, by stage.** The Pipeline gets a
   second arrangement:
   - today's arrangement stays: columns by what a change waits on;
   - the new one has columns by stage;
   - the cards are the same, and now show the Owner and the Implementer.

   A change opens to its history, with every visit to every stage and how
   long it lasted. Both hosts show the same board, since it comes from one
   core function. The CLI prints the same history.

8. **The core raises typed events for a change.** Events are raised when:
   - a stage is entered or left;
   - an Owner or an Implementer changes;
   - a change is sent back.

   They come from comparing one reading of the changes with the next, and
   they travel on the in-process bus of ADR 0018. For now they are an
   internal API, used by the board and the history view. They are the
   first extension point, and the only one this ADR makes.

9. **An archive keeps its history.**
   - `archiveChange` is the one entry point every archive in this product
     goes through. It moves `history/` into the archived directory after
     `openspec archive` returns.
   - The archive pass commits everything under `openspec/`, so the history
     lands with the archive.
   - A change archived by hand with the plain OpenSpec CLI leaves its
     `history/` behind. The leftovers reading moves it next to the
     archived change, and never clears it.

10. **Committed history and live coordination stay apart.** ADR 0028 keeps
    operational facts out of the repository: who is alive, what stage a
    run is in right now, who asked for a stop. This ADR does not change
    that. It commits a different kind of fact: decisions about the work
    (who owns it, who does it, why it went back), which are part of the
    record of the work. Every machine and every colleague has to see them.

11. **What this ADR does not decide, and why.** None of the following is
    decided here, and each waits until people outside this repository ask
    for team features:
    - a server or a database;
    - boards with columns of the team's own choosing;
    - transition policies, such as work-in-progress limits or required
      approvals;
    - reports beyond time in stage;
    - one-way sync to an outside board;
    - a plugin API for other people's code;
    - licensing.

    A paid plugin, if one comes, builds on the facts this ADR records, and
    changes none of them.

## Consequences

- Every machine and every colleague sees the same Owner, Implementer and
  history, with no server. A history that disagrees with itself is refused
  by the merge gate, not discovered later.
- A change's time in each stage becomes a fact, with its source. The
  "order, not time" limit of ADR 0025 ends for stages, and not for
  anything else.
- A repository gains two directories, `openspec/people/` and a `history/`
  inside each change that uses it. A change nobody assigns has no history
  and works as today.
- The forge interface grows by two dates on every implementation.
- A person's name, and an e-mail address if they choose to give one, are
  committed. That is their choice, made in their own pull request.

## Alternatives considered

**One file for the whole team, mapping each change to its Owner and
Implementer.** It is simple, but every change's pull request would edit
the same file, and parallel changes would conflict on it all the time.

**Owner and Implementer as keys in `harness.json`.** That file is a
configuration read before a run, and `harness-config.ts` refuses keys it
does not know. A history does not fit in a configuration, and a key there
could be edited in place, while history must only grow.

**Stages as declared events, moved by hand or by the product.** A second
truth beside the facts, which ADR 0024, ADR 0025 and ADR 0029 each
rejected for their own pictures. A declared stage and a derived one would
disagree the first time a pull request merged while nobody moved the
card.

**The forge as the store: pull request assignees, labels, project
boards.** Every forge models these differently, a change exists before
its pull request, and a history would be lost with a pull request that is
closed and replaced. The forge stays a source of facts about pull
requests, and a possible later place to show the board.

**A local SQLite database.** It would duplicate the repository as the
source of truth, would not reach another machine without a server, and
the owner ruled out a server.

**Unsigned history.** Anyone could write an event in anyone's name. The
signatures already exist for messages and status records, so signing costs
almost nothing.

## Amendment, 2026-09-25: a change before its proposal

Decision 5's list began at Proposed, "the change has a proposal". A change
directory made before its proposal - by `openspec new change`, or by hand,
holding `.openspec.yaml` or nothing yet - is a change too, and had no
stage. Worse, the reading of what can run passed it over entirely: a
directory with no change document was taken for a leftover of an archive,
though the leftover rule itself (`workspace-leftovers.ts`) already said a
directory is a leftover only where a change of its name was archived. The
board drew no card for it, so the one action it wants, propose, could not
be started from the Pipeline. Reported by a user on 2026-09-24, with three
such directories and none of them on the board.

The list gains a first stage:

| Stage | Reached when |
| --- | --- |
| Drafted | the change's directory exists and holds no proposal |

Decision 6 gains its row:

| Stage | Entered at | Source |
| --- | --- | --- |
| Drafted | the first commit that adds anything under the change's directory, where it came before the proposal's | git commit |

A change committed together with its proposal was never a draft and has no
Drafted visit: a visit of no length would be a stage it never stood in. A
directory not yet committed is Drafted with no entry date, as decision 6
requires of any fact that cannot be read.

A change without a proposal is Drafted whatever else its directory holds.
A directory with no change document is a leftover, not a Drafted change,
only where a change of the same name is already archived. The Changes tree
keeps listing such a start apart, as a change nobody has written yet; the
Pipeline reads it as a change. Starting a Drafted change begins at propose,
which is where a chain already begins for a change with no proposal.

A Drafted change cannot be sent back to: decision 4's `sent-back` event
names a stage a change has left, and nothing leaves a proposal to go back
to having none.

## Amendment, 2026-09-26: a team's own columns

Decision 11 deferred "boards with columns of the team's own choosing"
until people outside this repository asked. A user did on 2026-09-24, and
the owner agreed on 2026-09-25.

A team names its columns in `openspec/board.json`, committed beside
`agent-harness.json`, so every member sees one board:

```json
{ "columns": [
  { "title": "Backlog", "stages": ["drafted", "proposed"] },
  { "title": "Ready",   "stages": ["planned"] },
  { "title": "Doing",   "stages": ["in-progress"] },
  { "title": "Review",  "stages": ["in-review"] },
  { "title": "Done",    "stages": ["landed", "archived"] } ] }
```

A column is a view of stages, never a stage. Decision 5 stands: a change's
stage is derived from facts, and a card moves when a fact moves it, never
by being dragged. So:

- every stage is in exactly one column: a stage in none leaves its cards
  nowhere, a stage in two puts one card in two places;
- the columns keep the stages' order: a column may join neighbouring
  stages, never reorder them, since a card moves left to right;
- a stage is never split between columns: which of two a card stands in
  would be declared, not derived.

A file that breaks any of these is refused whole: the board says what is
wrong and draws the stages' own columns. A column is headed by its title,
counts every card in its stages, and takes the picture and colour of its
first stage. A card still says its own stage, and the history, the CLI
and the time in stage keep the stages' words.

Transition policies, columns by other facts, and one-way sync to an outside
board stay deferred, for the reason decision 11 gave.

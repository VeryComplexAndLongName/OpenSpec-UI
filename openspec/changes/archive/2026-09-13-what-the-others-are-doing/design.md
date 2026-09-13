# Design

See `docs/adr/0026-other-working-directories-are-observed-never-touched.md`
for the decisions: a directory is surveyed and never acted on, no git is
run against one this host does not own, a directory carries a label that
is not an identity, and nothing foreign enters the local order.

## Decision: a survey, not a second readiness report

`readChangeReadiness` derives facts that cost work: which changes
collide over a capability, which branches have changed the same files,
what can be started alongside what. That is right for the directory a
person is working in, where every answer is actionable.

For a directory somebody else is working in, none of it is. A collision
between two of their changes is not this viewer's to resolve, and
computing it costs a git invocation per directory on every read.

So the survey is a different, smaller thing: what a directory *is*,
rather than what could be done about it. Names, tasks, branch, lease.
The two are separate functions and the foreign one is not a degraded
version of the local one — it answers a different question.

## Decision: what is read, and what is never inferred

Read:

- the working directories, from one `git worktree list` against this
  repository — the only git this feature runs;
- each directory's branch and head, from the same output;
- the names under its `openspec/changes`, excluding `archive`;
- each change's `tasks.md`, for how many items are closed;
- its `.openspec-ui/workspace.lease.json`, where one exists.

Never inferred: whether an agent is working, stuck, or idle. A directory
with no lease means no mutating run holds it right now — an agent
editing files holds none. Reporting that as "idle" would be the same
mistake as calling a git author a user: a word the data does not
support, believed because it was displayed.

What a run says about itself is a different thing from an inference, and
is reported as exactly that — see "what a directory's runs say", below.

## Decision: what a directory's runs say, from the records they already write

Added 2026-09-13, after `an-agent-says-what-it-is-doing` gave every run
this product starts a status record (ADR 0028). Without it, a directory
whose agent has been running a command for twenty minutes and a
directory nobody is in look the same.

The records live in one directory shared by every working directory of
the repository. Reading them is one directory read per survey, not one
per working directory, and that directory is resolved from the `git
worktree list` output the survey already has — no second git invocation.
`resolveAgentStatusDirectory` runs its own `worktreeList` today, so the
survey passes the list it holds instead of calling it.

Each record is attached to the working directory whose path it names. A
record naming a path that is no longer a working directory — removed
since the run started — is reported as belonging to none, rather than
dropped or attached to a guess.

What is shown is what the run said: its change, its stage, its activity,
how long since it said so, and whether its heartbeat has lapsed past the
window. No verdict, by the same rule `openspec-ui-cli status` follows: a
long turn and a hang produce the same silence.

A directory with no record is not idle. A record exists only for a run
this product started. A person editing files, or an agent session
started some other way — the session that wrote this amendment was one —
writes none. The survey says no run reports there, and says nothing
more.

Reading is not sweeping. Removing records whose writer is gone belongs to
`a-stale-status-is-swept`; the survey only reads, and shows a lapsed
record as gone.

## Decision: the label, and why it lives in the directory

Each directory has a short label, defaulting to the last segment of its
own path. That default is free and already meaningful: somebody chose
`proposals` when they made it, and git guarantees no two working
directories share a path, so labels are distinct by construction.

It is overridable by `.openspec-ui/worker.json` in that directory — one
field, self-declared.

It lives in the directory rather than in the lease because the lease
exists only while a mutating run holds one. The ordinary state of a
directory is somebody editing files in it, holding nothing. The survey
has to name it then, which is most of the time.

## Decision: "label", not "owner"

"Owner" asserts authority over the thing named, and this view grants
none — it cannot act on a foreign change at all. `a-lease-says-who`
already found that a word which overstates gets believed: the lease says
"git author" and never "user", so that a self-declared string is not
read as an established identity. The same applies here.

## Decision: the git author answers a different question

The label says which working directory. The git author says whose
commits a run there would be. Neither substitutes for the other: on one
person's machine every directory reports the same author, and that is a
correct answer, not a failure of the label.

Where a directory's lease records an author different from this
checkout's own configured identity, the survey says so. That is the
signal that a second *person* — not merely a second directory — is at
work.

It is said in a word, and colour agrees with the word. Never colour
alone: the shell is held to WCAG AA by a browser suite that runs axe,
and the same rule already governs running-versus-blocked on a pipeline
card.

## Decision: each directory keeps its own picture

Each directory's changes are laid out by `layoutChanges` against that
directory's own queue, and drawn as their own picture.

They are not merged into one graph. A column means depth in a declared
order, and between changes on two branches the repository declares no
order at all — placing them in shared columns would assert one. For the
same reason no relation is drawn between directories: a line across
would be believed, because it would look like every other line.

## Decision: a duplicate is reported, not refused

A change can exist in two directories at once. It arises from ordinary
branching — cut a directory from a main that has active changes and all
of them come along — so refusing it would refuse the common case to
prevent the rare one.

While both copies are untouched it is inert: the archive of one side
merges cleanly against an unmodified other. It becomes a collision the
moment either is edited, which is exactly when somebody wants to know.
So it is surfaced, and nothing is done about it.

## Non-Goals

Acting on another directory: opening, running, ticking, releasing its
lease. All of it is refused by construction — there is no control.

A registry, a daemon, or any reporting protocol between agents. The
information is on this disk already, and a second source of truth would
be free to disagree with the filesystem and be believed.

Directories of other repositories, or on other machines. `git worktree
list` bounds this to working directories of this repository.

Merging foreign changes into the local readiness report, which would
make `openspec-ui-cli ready` answer for work its caller cannot start.

## Risks / Trade-offs

The survey is a reading, not a subscription: a directory can change
between two of them. It says when it last looked, as the pipeline tab
already does.

A directory can be on a network path or an unmounted drive, where a read
blocks or fails. One unreadable directory must be reported as unreadable
and must not remove the others from the survey.

Reading another directory's files means displaying content this host did
not write. It is displayed as text and never executed — the same footing
as repository file contents everywhere else in this tool.

Many directories make a long page. They are read less often than the
local one and only while being looked at.

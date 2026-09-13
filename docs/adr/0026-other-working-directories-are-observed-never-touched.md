# 0026: Other Working Directories Are Observed, Never Touched

Status: Accepted

Date: 2026-09-12

## Context

ADR-0022 gave a change its own working directory so two changes can run
at once, and ADR-0024 made what can run alongside what derivable rather
than declared. ADR-0025 drew the result as a picture. All three answer
for **one** working directory: the one the host was pointed at.

On 2026-09-12 two agents were working on this repository at once — one
in the primary checkout, one in `…​.worktrees/proposals` — and the owner
could see only their own. Six proposals existed a directory away and
were invisible from the tool built to show what is in flight.

Two things went wrong in that session that this ADR exists to stop
happening again, and neither was a bug in any code:

- The primary checkout was sitting on a branch whose pull request had
  already merged, so the tool honestly reported an empty queue. The
  owner could not tell "there is nothing to do" from "I am looking at a
  stale checkout". Nothing on screen named the branch being read.
- A change that had been archived in one directory was still present, as
  a tracked file, in another — inherited from the branch point, put
  there by nobody. Harmless while untouched, and a genuine collision the
  moment it is edited. Nothing would have reported it.

A working directory is not a remote thing. `git worktree` shares one
object store and one ref namespace: the sibling's `.git` is a file
naming a subdirectory of the primary's. Everything below is therefore a
local read, with no daemon, no network and no registry.

## Decision

**Other working directories are surveyed, and never acted on.**

The survey reports, per directory: the branch it has checked out, the
changes in its own `openspec/changes`, how far each one's tasks have
got, and — where a mutating run holds it — the lease's holder and git
author.

Read-only is a property of what the view can do, not of how it looks.
A foreign change carries no action: no opening it in the editor, no
starting a run against it, no ticking anything. Recessed styling
agrees with that fact; it does not create it.

The rule is specific because the failure is specific. A change's
identity is the pair `(working directory, name)`, not the name. Two
directories can hold a change of one name at different content — that
already happened here — and an action routed by name alone would act on
a different change while looking perfectly correct.

**No git is run against a directory this host does not own.**

Enumerating the working directories is one `git worktree list` against
this repository, which this host does own. Everything after that is a
filesystem read: names under `openspec/changes`, each `tasks.md`, each
`.openspec-ui/workspace.lease.json`.

The collision detection of ADR-0024 is deliberately not computed for a
foreign directory. It costs a git invocation per directory per read, and
it answers a question the viewer cannot act on: a collision between two
changes in somebody else's directory is not theirs to resolve. Work not
worth doing is not made cheap by moving it to the background — the
background changes who waits, not what is spent.

**A directory is labelled, and the label is not an identity.**

Each working directory carries a short label. It defaults to the
directory's own name — `proposals` — which is already chosen, already
meaningful, needs no configuration, and is distinct by construction
since git will not put two working directories at one path. It can be
overridden by a file in that directory.

The label lives in the directory and not only in the lease, because the
lease exists only while a mutating run holds one. An agent editing files
holds no lease, and that is the ordinary state — the survey has to work
then, which is most of the time.

The word is "label" and not "owner". "Owner" asserts authority, and this
view grants none; the lesson of ADR-0025's neighbour, `a-lease-says-who`,
is that a word which overstates gets believed. The label is
self-declared: attribution, never authentication.

**The git author is reported, and reported as different when it is.**

The lease already records the git identity of the directory that took
it. Where that identity differs from this checkout's own, the survey
says so — that is how a second *person* becomes visible, as opposed to a
second directory.

It is said in a word and agreed with by colour, never carried by colour
alone: this shell is held to WCAG AA, and a reader who cannot separate
two hues must still be able to tell whose run it is.

The two are different questions and neither stands in for the other. The
label answers "which working directory"; the git author answers "whose
commits would this be". On one person's machine every directory reports
the same author, and that is correct rather than a defect.

**Nothing foreign enters the local order.**

Each directory's changes are laid out on their own, by the layout of
ADR-0025, against that directory's own queue. They are never merged into
another directory's columns and no relation is drawn between directories.

A column means depth in a declared order. Between changes on two
branches the repository declares no order at all, so a line across would
assert a sequence that does not exist — the same reason a collision is
not an edge in ADR-0025, and believed for the same reason: it would look
like every other line in the drawing.

**A change in two directories at once is reported.**

Not prevented, and not resolved. It arises from ordinary branching — cut
a working directory from a main that has active changes and every one of
them comes along — so it is a condition to be noticed, not an error to
be refused.

## Consequences

The survey works with no configuration: a directory that declares
nothing still reports its name, its branch and its changes.

The tool can say which branch each reading came from, so an empty queue
is distinguishable from a stale checkout.

A foreign directory costs filesystem reads and no subprocess. It is read
less often than the local one and only while being looked at, on the
same reasoning ADR-0025 used for the tab itself.

The survey is a reading, never a subscription. A directory can change
between two of them, and the view says when it last looked.

## Amendment, 2026-09-13: what a directory's runs say

ADR-0028 gave every run this product starts a status record, in one
directory beside all of a repository's working directories. The survey
reads those records too, and shows under each directory what its runs
say they are doing and how long ago.

This stays inside every rule above. The records are read once per
survey from a directory the survey locates with the `git worktree list`
it already ran, so no git is run against a foreign directory and no
subprocess is added. Nothing is acted on: a record is read, never
removed or renewed. And a directory with no record is not called idle —
a session this product did not start writes none, which is the same
reason a directory with no lease is not called idle.

## Amendment, 2026-09-13: asking a run to stop does not touch its directory

ADR-0029 puts controls on the Pipeline's cards. Two of its decisions
concern the rules above.

**A change that has its own worktree is drawn as one card.** ADR-0022
creates that worktree for the change, and the card's tasks and run are
read from it. That is a filesystem read like every other read here. The
card names the directory it read, so a change is still identified by the
pair of a directory and a name.

**A run elsewhere may be asked to stop, through ADR-0028's channel.**
Asking does not touch the run's directory:

- the request is a file the person asking writes into the channel, which
  lies outside every working directory;
- it is addressed to a run by that run's identifier, never to a change by
  its name;
- the run decides whether to stop, and when.

The change in that directory still offers no action: nothing opens it,
starts a run against it, or ticks anything in it. A run's card offers the
request only where a signature shows that the run belongs to the person
asking.

## Amendment, 2026-09-13: where a change stands, wherever it is

The rules above show another directory's changes beneath this one's, in a
picture of their own. They do not tell a person where **their** change
stands. The Changes view of one checkout shows that checkout's copy of each
change and nothing else. So a change can be:

- archived on `main`,
- further along in another working directory,
- pushed on its own branch with a pull request merged, or
- running somewhere else,

while this view shows it untouched, and a person can start it again. That
happened in this repository: the owner could not see which changes had
already been done by an agent or by the Harness in another branch or
directory.

The goal the owner set on 2026-09-13: whoever works with a change sees, at
all times and wherever the change is, as accurate a picture of it as can be
read.

**A change has one standing, read across the repository.** It is read from:

- this checkout's copy;
- every working directory's copy, which the survey already reads;
- the repository's `main`, local and remote, and the branch ADR-0022 names
  after the change, as this repository's own git objects hold them;
- where `gh` is present and signed in, the pull request for that branch,
  and whether it is open, merged or closed.

**Git is still run only against this repository.** Every working
directory's branches are refs of this one repository, so reading `main` or
a change's branch means `git ls-tree` and `git show` here, never in a
foreign directory. Reading pulls, checks out, merges and pushes nothing.

**A reading says how fresh it is.** A remote's refs are only as current as
the last fetch, and a stale `main` shown as current is exactly the failure
this amendment exists to stop. So:

- the reading fetches, without touching any working tree, on a slow
  interval while a view that shows standings is open, and again when a run
  is about to start;
- it states when the remote's refs were last fetched;
- it says so when a fetch failed, or when `gh` is absent and pull requests
  were not read. Whatever could not be read is named, and never replaced by
  a guess.

**What a change's standing contributes is one state word, and the facts
behind it.** The words come from the one closed set that ADR-0029's
amendment of the same day defines for every surface: Running in a
directory, Archived on main, Merged in a pull request, Deleted on main, and
Further along elsewhere. Each fact beneath the word names its source.
Examples:

- "k of m tasks done in `label`, j of m here";
- "only here";
- "behind the copy in `label`".

A colour agrees with the word and never carries it alone (WCAG AA, as
above).

Every surface that lists changes says the same word: the Changes tree, a
Pipeline card, the terminal. It comes from one function in core, for the
reason ADR-0025 gave: two derivations of one answer drift apart, and both
look plausible.

**Starting a run says the standing first.** Where a change is archived or
deleted on `main`, merged, or running elsewhere, the run dialog says so, and
the person confirms before anything starts. It is not refused: a condition
is reported, not forbidden, as the rules above already hold.

**Reading costs something, and is bounded:**

- a `git ls-tree` of `main` and of each change's branch per reading, all
  against this repository, until the refs move;
- one fetch per interval;
- one `gh` call per branch that has a pull request, where `gh` is present.

The proposal that implements this measures that cost on this repository
before it is accepted.

## Alternatives considered

**A central registry or daemon agents report to.** Rejected: the
information is already on this disk, and a registry would add a second
source of truth that can disagree with the filesystem — and be believed,
because it is the one being displayed.

**Reading git in each foreign directory for a full readiness report.**
Rejected above: a subprocess per directory per read, for collisions the
viewer cannot act on.

**Merging every directory's changes into one graph.** Rejected: it would
place changes from unrelated branches in shared columns, asserting an
order the repository does not contain.

**Identifying a directory by its git author.** Rejected: on one person's
machine every directory reports the same author. It answers a different
question, and is kept for that question.

**Refusing to create a working directory that would duplicate an active
change.** Rejected for now: it would refuse the ordinary case (branching
from a main with work in flight) in order to prevent the rare one
(editing both copies). Reporting it costs nothing and forbids nothing.

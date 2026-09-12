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

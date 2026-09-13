Two agents worked on this repository at once and the owner could see one
of them. The tool reported the queue of the directory it was pointed at,
which was sitting on a branch whose pull request had already merged, so
it said there was nothing to do — and nothing on screen named the branch
it had read.

## 1. The survey

- [ ] 1.1 `worktree-survey.ts` in core: every working directory of this
  repository, each with its path, label, branch, head, changes, and the
  lease holder where one exists.
- [ ] 1.2 One `git worktree list` and nothing else. No git is run against
  a directory this host does not own — see ADR 0026. Everything after
  that is a filesystem read.
- [ ] 1.3 Per directory: the names under `openspec/changes` other than
  `archive`, and each one's closed and total task counts.
- [ ] 1.4 The lease is read where present. Absent means no mutating run
  holds it — never "idle", which is a claim the data does not make: an
  agent editing files holds no lease.
- [ ] 1.5 A directory that cannot be read is reported as unreadable and
  does not remove the others. A network path or an unmounted drive is
  one directory's problem, not the survey's.
- [ ] 1.6 Collisions are deliberately NOT computed for a foreign
  directory: a git invocation per directory per read, answering a
  question the viewer cannot act on.
- [ ] 1.7 A change present in more than one directory is reported as
  such. Not refused and not resolved — it comes from ordinary branching.
- [ ] 1.8 The survey reads the repository's status records once —
  `readAgentStatuses` over the status directory resolved from the `git
  worktree list` output it already holds, passed in rather than listed
  again — and attaches each record to the working directory whose path
  it names.
- [ ] 1.9 A record naming a path that is no longer a working directory is
  reported as belonging to none, not dropped and not attached to a guess.
- [ ] 1.10 Per run: its change, stage, activity, how long since it was
  said, heartbeat age, and whether it is gone. No field says stuck, hung,
  idle or healthy.
- [ ] 1.11 A directory with no record is described as one where no run
  reports, never as idle: a session this product did not start writes no
  record.
- [ ] 1.12 Reading never removes a record. Sweeping belongs to
  `a-stale-status-is-swept`.

## 2. The label

- [ ] 2.1 Defaults to the last segment of the directory's own path. Free,
  already meaningful, and distinct by construction: git will not put two
  working directories at one path.
- [ ] 2.2 Overridable by `.openspec-ui/worker.json` in that directory,
  one field.
- [ ] 2.3 Lives in the directory and not only in the lease. The lease
  exists only while a mutating run holds one, and the ordinary state is
  somebody editing files, holding nothing.
- [ ] 2.4 Called a label, never an owner. "Owner" asserts authority this
  view does not grant, and `a-lease-says-who` already found that a word
  which overstates gets believed. Self-declared: attribution, never
  authentication.

## 3. Whose run it is

- [ ] 3.1 The survey marks a directory whose lease records a git author
  different from this checkout's own configured identity.
- [ ] 3.2 Said in words; colour agrees with the words and never carries
  the distinction alone. The browser suite runs axe at WCAG AA, and the
  same rule already governs running-versus-blocked on a card.
- [ ] 3.3 The label and the git author are reported as separate facts.
  On one person's machine every directory reports the same author, which
  is a correct answer rather than a failure of the label.

## 4. Getting it to the shell

- [ ] 4.1 A server endpoint carrying the survey, in the shape core
  returns.
- [ ] 4.2 A webui client, browser-safe: it asks, it does not derive.
  `packages/server/src/static.test.ts` is the gate.

## 5. Showing it

- [ ] 5.1 The pipeline tab names the branch its reading came from, so an
  empty queue is not mistaken for a stale checkout. This is the one item
  that would have saved the session that prompted this change.
- [ ] 5.2 Each foreign directory gets its own picture beneath the local
  one, laid out by `layoutChanges` against that directory's own queue.
- [ ] 5.3 Recessed, and labelled with its label, its branch, and — where
  a run holds it — the holder and git author.
- [ ] 5.4 No relation is drawn between directories. The repository
  declares no order between them, and a line would be believed because
  it would look like every other line.
- [ ] 5.5 A foreign change carries no action: no opening, no running, no
  ticking. Read-only is what the view can do, not how it looks.
- [ ] 5.6 A duplicate change is called out where it appears.
- [ ] 5.7 Foreign directories are read less often than the local one, and
  only while the tab is being looked at.
- [ ] 5.8 Each directory's picture — the local one included — shows what
  its runs say they are doing and how long ago, a gone run as gone, and a
  directory where no run reports as such, all in words.

## 6. Tests

- [ ] 6.1 Core: two working directories, each with its own changes; both
  surveyed with their branches.
- [ ] 6.2 Core: a directory with no lease is reported as held by nobody,
  and never as idle.
- [ ] 6.3 Core: an unreadable directory is reported as such and the rest
  of the survey survives.
- [ ] 6.4 Core: the label defaults to the directory name and a declared
  one overrides it.
- [ ] 6.5 Core: one change in two directories is reported as duplicated.
- [ ] 6.6 Core: no git subprocess is invoked per foreign directory —
  asserted against a wrapper that records its calls, because this is a
  cost the code could reacquire silently.
- [ ] 6.7 webui: a foreign change offers no action, and a foreign
  directory whose author differs says so in words rather than only in
  colour.
- [ ] 6.8 webui: no relation is drawn between two directories.
- [ ] 6.9 Browser suite: the tab with a second working directory passes
  axe at WCAG AA, and its screenshot under `docs/images/standalone/` is
  regenerated.
- [ ] 6.10 Core: a status record is attached to the directory it names,
  and one naming a removed directory is reported as belonging to none.
- [ ] 6.11 Core: a directory with no record is not described as idle —
  asserted against the whole reported shape, because that word is the one
  somebody will helpfully add later.
- [ ] 6.12 Core: resolving the status directory adds no git invocation —
  the recording wrapper of 6.6 sees the one `worktree list` and nothing
  more.
- [ ] 6.13 webui: a foreign directory's run shows its activity and its
  age in words, and a gone run says gone.

## 7. Verification

- [ ] 7.1 This change validates strictly. `check(validate-change)`
- [ ] 7.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 7.3 The whole browser suite, not a selected spec.
- [ ] 7.4 A pending changeset exists. `check(changeset-present)`
- [ ] 7.5 **Delegated to `claude-cli`**: with a second agent actually
  working in a second working directory, open the tab and check that its
  label, branch and changes are the ones on disk there, that nothing
  offers to act on them, that a run held there names its git author, and
  that what the run says it is doing matches what `openspec-ui-cli
  status` prints for it at the same moment. Evidence: both directories,
  the tab, and the command's output. The unit tests drive the
  survey with directories a test made; only a real second agent shows
  that what it writes is what the survey reads.

# 0035: A Change That Has Landed Is Archived for You

Status: Accepted

Date: 2026-09-21

## Context

A change lands when its pull request merges (ADR 0022). Its directory
then sits in `openspec/changes/` on the default branch until somebody
runs `openspec archive`, commits the move and lands that too. In this
repository that somebody is an agent, working by hand, in batches.

Two things follow, and the owner has named both. A change the owner
finished minutes ago still shows as live in the Pipeline and in Changes,
and the owner has to work out whether it is really done. And nobody
notices an archive that is due until the list is long: on 2026-09-21 a
change merged in #656 stayed in `openspec/changes/` until the owner asked
why it was still there. The owner's words: done changes must be archived,
merged and shown only in the archive.

What makes a change finished was settled the same day
(`a-change-lands-with-nothing-open`, `a-change-is-archived-with-nothing-open`).
Every task item ends done, waived or deferred, and the merge gate refuses
a change that still owes one. So "landed and owes nothing" is something
the default branch itself can answer, without asking anybody.

The same rule that ADR 0034 made an exception to applies here. `HARNESS.md`
says a workspace default must never grant push. Archiving pushes a branch,
opens a pull request and asks for it to merge.

## Decision

1. **A change that has landed and owes nothing is archived for you**, by
   the same sweep that removes a finished working directory and rebases a
   branch that has fallen behind (ADR 0034), in every host that sweeps.
   It is on by default, under one setting that turns it off -
   `archive.whenLanded` in `openspec/agent-harness.json`. A change's own
   `harness.json` may set it for that change.

2. **A change has landed and owes nothing when all of these hold**, each
   read from the default branch as the server has it, after a fetch:
   - its directory is in `openspec/changes/` there, not yet in the
     archive;
   - its `tasks.md` there has at least one item, and every item is closed
     and says how - the same reading the merge gate and `archiveChange`
     use;
   - no pull request from a branch named after it is open. Work on it is
     not finished while one is.

3. **Every change that is due goes into one pull request per pass.** The
   sweep checks out the default branch into a directory of its own,
   outside the workspace, on a new branch named `archive-landed-<date>`.
   It runs `openspec archive` for each change, commits, pushes and opens
   the pull request. Then it asks the forge to merge it once its checks
   pass, and removes the directory and the local branch. A change whose
   archive fails is left out and reported. The others go ahead.

4. **One at a time.** While a pull request from an `archive-landed-`
   branch is open, the sweep opens no other. It reports that it is
   waiting for that one. A change that becomes due meanwhile goes into
   the next pass.

5. **The pull request lands like any other.** It runs the same checks,
   and the merge gate holds every change it archives to the rule it was
   archived by (`--base`). The sweep asks for an automatic merge and
   merges nothing itself. Where the repository does not allow automatic
   merges, the pull request is left open, and the sweep says so and why.

6. **The forge is reached through an interface.** Listing pull requests,
   opening one and asking for an automatic merge go through one interface.
   It is implemented for GitHub, through `gh`, first. GitLab and Gitea
   implement the same interface later, and the sweep does not change for
   them.

7. **This is a second exception to the rule in `HARNESS.md`, and it is
   kept as narrow as the first.** That rule exists because the `git` stage
   pushes whatever an agent made. Here the product pushes one thing only:
   the result of `openspec archive` over changes the default branch
   already says are finished. That is a move of files already on the
   server, plus the spec updates the archive command derives from them.
   It lands only through a pull request and its checks. The rule stands
   for everything else. This setting does not widen `gitStageAllowlist`
   or `reviewGate`, and it pushes no branch but its own.

## Consequences

- A change leaves the live lists shortly after its work lands. What the
  Pipeline and Changes show is what is still in flight.
- Every archive costs one run of the checks, but per pass, not per
  change.
- A merged change that still owes something is never archived. The merge
  gate should make that impossible. Where it happens anyway (a gate
  turned off, a force-merge), the change stays visible and the sweep
  names what it owes. That is the alert.
- The product pushes and opens pull requests without a stage asking it
  to. That is written here, in the setting's documentation, and in
  `HARNESS.md` beside the rule, so nobody finds it by surprise.
- A repository without the openspec CLI, without a signed-in forge, or
  without a remote archives nothing. The sweep says why once per pass
  where there was something due.

## Alternatives considered

**Archive in the change's own pull request, before it merges.** One pull
request instead of two, and no second round of checks. But the change
would be archived before its last item closed - many items close in the
pull request's final commits, and some only once it has landed. The merge
gate reads the task list at the head of the pull request, and archiving
would move it. The rule "a change is archived with nothing open" would
then be checked against a moving target.

**A workflow in CI that archives on merge.** It would run whether or not
anybody's editor is open. It would also serve only this repository. Every
other repository using the product would have to install it, keep it and
give it a token that can push. ADR 0034 rejected the same alternative for
the same reason.

**Archive directly on the default branch, without a pull request.** No
second round of checks and no wait. It would also push to a protected
branch, which this repository forbids and most others should. And the one
archive with a mistake in it would land unchecked.

**Off by default.** This is how the gap arose: the archive is the step
nobody remembers, and the owner found out by asking.

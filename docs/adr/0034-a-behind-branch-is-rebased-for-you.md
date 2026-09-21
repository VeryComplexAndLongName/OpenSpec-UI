# 0034: A Change's Branch That Falls Behind Is Rebased for You

Status: Accepted

Date: 2026-09-21

## Context

A change is worked on its own branch, named after it (ADR 0022), in its
own working directory, and lands through a pull request. While it waits,
other pull requests land and its branch falls behind the default branch.

Since `main-no-longer-requires-an-up-to-date-branch` that no longer
blocks a merge: a pull request lands when its own checks are green. It
left one gap, written into the runbook on purpose - two pull requests
that are green apart can be broken together, and git catches only the
textual half of that. The remedy is known and dull: rebase the branch on
the current default branch, push it, and let its checks run again. On
2026-09-20 an agent did that by hand after every merge, five times in an
afternoon, and a person had to notice each time that it was due.

The owner asked for it to be the product's job, for everybody who uses
the product, as a setting that is on unless turned off.

That runs into a rule this product already keeps. `HARNESS.md` says of
the settings that let the `git` stage push, open and merge pull
requests: "A workspace default must never grant that; only a specific
change's own file can." A setting that pushes, on by default, is a
workspace default that pushes.

## Decision

1. **A change's branch that has fallen behind the default branch is
   rebased onto it and pushed**, by the same sweep that removes a
   working directory whose work has landed, in every host that sweeps.
   It is on by default, under one setting that turns it off -
   `branches.rebaseWhenBehind` in `openspec/agent-harness.json`, which a
   change's own `harness.json` may override.

2. **Only when every rail holds**, and each one is checked, not assumed:
   - the branch bears the name of a change (ADR 0022) - a branch this
     product did not name is never touched;
   - it has an upstream, and that upstream is not gone - it was pushed,
     and it is still on the server;
   - its working tree is clean;
   - no run is recorded against its working directory;
   - it is behind the default branch and not ahead of its own upstream -
     there is nothing of it on this machine that the server lacks.

3. **The push is `--force-with-lease`**, against the upstream as it was
   read. If anybody else pushed to that branch in the meantime, the push
   is refused and nothing of theirs is overwritten.

4. **A conflict is never resolved.** The rebase is aborted, the branch is
   left exactly as it was, and the sweep reports that a rebase is needed
   and names the files in conflict, where it reports everything else it
   did. Resolving a conflict is a judgement about two people's work, and
   a sweep has neither's intentions.

5. **Every rebase is reported**: which branch, onto what, and that its
   checks will run again. A rebase that was due and did not happen says
   which rail stopped it.

6. **This is an exception to the rule in `HARNESS.md`, and it is kept
   narrow on purpose.** That rule exists because the `git` stage pushes
   *new work* - commits an agent made - and opens and merges pull
   requests: it adds to what the server holds, and its blast radius is
   whatever the agent did. A rebase adds nothing. It moves commits that
   are already on the server onto a newer base, and the lease makes it
   unable to take anything away. The rule stands for everything else;
   this setting does not widen `gitStageAllowlist` or `reviewGate`, and
   it cannot push a commit the server has never seen.

## Consequences

- A branch is re-checked against the current default branch after every
  merge, without anybody noticing that it was due. The gap the runbook
  names - green apart, broken together - is closed for textual and
  semantic breakage alike, since the checks run on the rebased tree.
- Each rebase costs a full run of the pull request's checks. With several
  pull requests open, one merge starts that many runs. That is the price
  of the gap being closed, and the setting is how a repository that
  would rather not pay it says so.
- Somebody with the branch checked out elsewhere sees its history
  rewritten, and their next pull needs `--rebase`. Under ADR 0028's
  basis - one person, one computer - that somebody is the same person.
  A team that shares change branches should turn the setting off.
- The product now pushes without a stage asking it to. That is written
  here, in the setting's own documentation, and in `HARNESS.md` beside
  the rule it is an exception to, so that nobody finds it by surprise.

## Alternatives considered

**A workflow in CI that rebases open pull requests.** It would run
whether or not anybody's editor is open. It would also help only this
repository: every other repository using this product would have to
install and maintain the workflow, which is exactly the headache the
owner asked to take away. The product is where every user already is.

**Merge the default branch into the change's branch instead of
rebasing.** No force-push, so no rewritten history. But every catch-up
leaves a merge commit, a change's branch becomes unreadable after a busy
afternoon, and this repository squash-merges, so the merge commits would
be noise that exists only to be thrown away.

**Off by default.** Safer on paper. In practice it is the press nobody
remembers, which is how six working directories accumulated in a day
before `git-says-a-working-directory-is-done` made that sweep act rather
than offer.

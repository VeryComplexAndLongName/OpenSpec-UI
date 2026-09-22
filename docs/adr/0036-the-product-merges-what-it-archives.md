# 0036: The Product Merges What It Archives

Status: Accepted

Date: 2026-09-22

Supersedes decision 5 of [ADR 0035](0035-a-landed-change-is-archived-for-you.md).

## Context

ADR 0035 archives a change that has landed with nothing open. It opens one
pull request per pass and, by its decision 5, asks the forge for an
automatic merge and merges nothing itself.

That left the outcome to each repository's settings, and they differ:

- GitHub refuses automatic merge unless the repository allows it
  ("Auto merge is not allowed for this repository"). A new repository does
  not allow it, which was seen live on 2026-09-22.
- GitLab and Gitea each have their own switch for merging when the
  pipeline or the checks pass. Each can be turned off, or set to need an
  approval.
- Where automatic merge was refused, the pull request stayed open with a
  line in the output, and waited for a person who had not asked for it.

The owner's words, on 2026-09-22: do everything ourselves, and do not rely
on the repository's settings. The product must behave the same, and
predictably, on every forge, whatever the settings. The person using it
must be able to trust that it finishes what it has started.

## Decision

1. **The product follows its own archive pull request and merges it.** No
   forge is asked to merge later by its own rules. The `Forge` interface
   loses `mergeWhenChecksPass`. Every forge - GitHub through `gh` or its
   API, GitLab, Gitea - implements the same two calls: `checksOf` reads
   the checks as `parseCheckStatus` does, and `mergeNow` merges by a named
   method and deletes the branch.

2. **What the checks say decides.** Each pass reads the open
   `archive-landed-` pull request:
   - checks still running: it waits;
   - every check that ran passed: it merges;
   - no check ran at all: it merges. An archive only moves directories
     that `openspec archive` wrote. A repository with no checks would
     otherwise keep it open forever;
   - a check failed: it does not merge, and says which check failed.

   The `git` stage keeps ADR 0014's stricter rule and refuses where no
   check ran, because it merges what an agent wrote.

3. **Squash first, then merge, then rebase.** A repository allows some
   methods. A refusal of the method only moves on to the next method. Any
   other refusal - a required approval, a protected branch, a token that
   may not merge - leaves the pull request open. The sweep says the
   forge's own reason, in the editor as a warning once per reason. It
   reads the pull request again on the next pass, and merges once it can
   or once a person has closed it.

   *Amended by `an-archive-keeps-up-with-main`:* a refusal while the
   default branch has moved on past the archive's branch is not left
   standing. A repository that merges only what is up to date would
   refuse it on every pass. The sweep makes the archive again on the
   default branch as it is now and moves its own branch there with a
   lease, and the checks run again.

4. **A new pull request is read from the next pass on.** A moment after
   opening, a forge may not yet have started the checks it will run, and
   would read as having none. Merging then would skip them.

5. **The sweep follows every few minutes while one is open.** The editor
   and the standalone server both sweep again five minutes after a pass
   that left an archive pull request open, until it merges. The half-hour
   interval stays for everything else. A pass that merges fetches at
   once, so the archive reaches the main checkout in that same pass
   (`branches.followMain`).

## Consequences

- An archive lands the same way on GitHub, GitLab and Gitea, with or
  without automatic merge allowed, and with or without checks.
- The product needs the right to merge. A token or a `gh` session that can
  open a pull request but not merge it leaves the pull request open. The
  sweep then says why, in the forge's words.
- A forge rule the product must not get around still holds. A required
  approval or a protected branch refuses the merge, and the sweep reports
  the refusal instead of working around it.
- Following costs one reading of the checks every five minutes, and only
  while an archive pull request is open.

## Alternatives considered

**Keep automatic merge, and merge ourselves only where it is refused.**
There would then be two ways to land, chosen by a setting the person may
not know about. On the same product the same repository would behave
differently from one day to the next. That is what the owner asked to
remove.

**Refuse where no check ran, as the `git` stage does.** A repository
without CI would never have an archive merged. It would also be told,
every pass, about a check that does not exist. The archive's content is
mechanical, and the merge gate that holds each change to its rule runs
where there is CI.

**Merge in the same pass that opens the pull request.** It is quicker, but
a forge that has not yet registered its checks reads as having none, and
the merge would skip them.

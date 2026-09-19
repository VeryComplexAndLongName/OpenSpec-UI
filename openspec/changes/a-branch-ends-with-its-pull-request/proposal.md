## Why

This repository squash-merges its pull requests. A merged branch's tip is
therefore never an ancestor of `main`, so nothing detects it as finished
afterwards, and nothing removes it. On 2026-09-19 the owner's checkout held
184 local branches and 45 on the server; 175 and 40 of them belonged to
pull requests merged as far back as the spring. The owner asked, on the
same day, for the rule to be written down somewhere rather than carried in
one person's head.

Three further rules were agreed in conversation on 2026-09-19 and are
recorded nowhere:

- one change is one pull request, and the pull request's title is the
  change id, verbatim;
- archiving is a second pull request, one per change, titled
  `<change-id> (archive)`;
- anything left to finish once a pull request is open is a new change and
  a new pull request, not another commit on the open one.

The last of these has a cost that has already been paid twice: the owner
merges quickly, and a commit pushed to a branch whose pull request has
merged is stranded where nobody will look for it again.

## What Changes

- `openspec/README.md` gains a section under **Change Governance**,
  `A branch ends with its pull request`, stating the four rules above and
  what to do once a pull request merges: delete the branch locally and on
  the server, and remove its working directory and the empty shell that
  `git worktree remove` leaves behind on Windows.
- The section names the repository setting that does the server side by
  itself, so the rule does not depend on anybody remembering it.

## Capabilities

### New Capabilities

(none - process documentation only, no behavior change)

### Modified Capabilities

(none)

## Impact

- `openspec/README.md` only.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- Deleting a branch automatically from the product. The Pipeline already
  knows which pull requests merged, and offering the deletion there is
  worth doing, but it belongs with the change that teaches `main` to catch
  up with what landed, not here.
- A branch naming convention. What a branch is called is not what this is
  about; when it ends is.

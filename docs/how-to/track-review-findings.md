# Track PR Review findings

Open PR Review and choose **Edit Review Findings**. Add a short description and,
if it helps locate the finding, a repository path such as `src/session.ts`
with its line number. For example, record "An expired session can reach the
checkout route" at `src/session.ts:42`. The finding records the commit you were
reviewing.

After committing the correction, open PR Review at the new commit, select the
finding, choose **fixed**, and enter what changed. A reviewer can select
**verified** at a commit that includes the recorded correction and enter what
they checked. For example, "The expiry scenario passed in JUnit on this
commit." The review shows the correction commit, verification commit and note.
Verification for an older checkout is marked historical.

Use **dismissed** with a reason when the finding should not be addressed.
Use **reopen** with a note if a dismissed or addressed finding needs more work.
If a linked worktree changes the same findings while your review is open,
reopen PR Review before submitting a decision.

Findings are stored locally for the change and available from linked worktrees.
Use **Copy PR summary** to share them with the rest of the review. A saved
finding does not change the working tree or post to the forge.

# LinkedIn post: a-change-is-committed-where-it-is-made

Publish between 2026-11-07 and 2026-11-09: the site page is live from 2026-11-04,
and this goes out three to five days after it, not on the same day.
Attach: `docs/articles/site/a-change-is-committed-where-it-is-made/cover.jpg`.
Put the repository link in the first comment, not in the post.

## Post

A change worked in its own worktree could have its own harness set nowhere but
in the file. Every control added to the tree and not to the card, or the other
way round, left one host or one kind of change poorer.

The fix: when a change is made, everything needed is done. The agent rules now
say when - commit the planning artifacts on the change's branch and push it as
soon as they are written; commit and push after every task ticked; leave
nothing uncommitted at the end of a turn.

Create Change commits and pushes the new change at once. A card offers Commit
Change and Run Change in the arrangement by step, not just on the board.

Full write-up: https://openspec-ui.dev/articles/a-change-is-committed-where-it-is-made/

If you have ever lost work because a tool forgot to commit, what did you do about it?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

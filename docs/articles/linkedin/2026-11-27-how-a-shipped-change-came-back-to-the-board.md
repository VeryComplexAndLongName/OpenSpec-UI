# LinkedIn post: how-a-shipped-change-came-back-to-the-board

Publish on 2026-11-27, three days after the site article on 2026-11-24.
Attach `docs/articles/site/how-a-shipped-change-came-back-to-the-board/cover.png`.
Put the repository link in the first comment.

## Post

Eight minutes after an OpenSpec change was archived, another pull request put it back among the active changes. The merge gate passed. The Pipeline showed the shipped work as unfinished.

Workbench now compares a PR's active changes with the archives on its base. A second incident showed a similar card from a clean detached worktree. The Pipeline offers that directory under Left behind so the operator can decide what to do with it.

Both cases start with the same symptom. The card's checkout tells you where to look.

Full write-up: https://openspec-ui.dev/articles/how-a-shipped-change-came-back-to-the-board/

## First comment

OpenSpec Workbench code and issues: https://github.com/VeryComplexAndLongName/OpenSpec-UI

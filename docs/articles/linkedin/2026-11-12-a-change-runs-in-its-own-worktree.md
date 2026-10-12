# LinkedIn post: a-change-runs-in-its-own-worktree

Publish between 2026-11-12 and 2026-11-14: the site page is live from 2026-11-09,
and this goes out three to five days after it, not on the same day.
Attach: `docs/articles/site/a-change-runs-in-its-own-worktree/cover.jpg`.
Put the repository link in the first comment, not in the post.

## Post

The owner ran a change from its card, and the stage failed: cwd is outside
the workspace.

A host binds its agents to one root, and every agent's sandbox refuses a run
whose cwd is outside it. A change is made in a worktree of its own, which is
not inside the workspace - so every run in a worktree was refused.

The fix: a run inside a worktree gets that worktree's own agents, whose
sandbox is that worktree. The run dialog reads and writes the change's harness
where the change is worked.

The CLI never met this problem - it always built its agents for the directory
you pointed at.

Full write-up: https://openspec-ui.dev/articles/a-change-runs-in-its-own-worktree/

Have you had a sandbox that was too strict for its own good?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

# LinkedIn post: a team works through git

Publish on 2026-10-02: a few days after the site page (2026-09-27), not the same day.
Attach: `docs/articles/site/a-team-works-through-git/board.png`.
Put the repository link in the first comment, not in the post.

## Post

Every "we added team support" pitch reaches for the same two things first: a server, and a database.

OpenSpec Workbench now answers three questions a team actually asks - whose change is this, why did it go back a step, how long did it spend in each step - with neither. People are files in the repository, one public key per machine, and joining a team is a pull request that adds one. A change's Owner and Implementer, and its full history of who did what and why, live as signed events in git - one file per event, so two branches never edit the same file and a merge never conflicts.

The part I like best: a change's stage is never set by a person or a button. Proposed, Planned, In progress, In review, Landed, Archived - each one is proved by a dated fact (a commit, a pull request opening, a merge), the same way this project has always derived a change's state instead of declaring it. The Pipeline now draws the same cards as a board, by stage, in both the web app and the editor.

What it deliberately doesn't do yet: no board columns of your own choosing, no work-in-progress limits, no plugin API. All ruled out on purpose, not just postponed - they wait until people actually ask.

Full write-up: https://openspec-ui.dev/articles/a-team-works-through-git/

If you've tried to add "team" to a tool without a server, what did you give up to get there?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

## Where each claim comes from

Not for posting.

- The decision and what it rules out on purpose: `docs/adr/0037-a-team-works-through-git.md`.
- People as files, signed history, derived stages, the board: the archived
  changes `a-team-works-through-git`, `a-change-knows-its-stage`,
  `the-board-shows-the-stages`.
- The article itself: `docs/articles/site/2026-09-27-a-team-works-through-git.md`.
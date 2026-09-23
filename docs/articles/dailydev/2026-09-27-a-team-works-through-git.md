# daily.dev post: a team works through git

For the owner to post, in the relevant Squad. Nothing is posted by merging
this file.

Publish 2026-09-29: a couple of days after the site page (2026-09-27), not
the same day as the LinkedIn post (2026-10-02).

Attach: `docs/articles/site/a-team-works-through-git/board.png`.

## Post

**A team works through git - no server, no database**

Every "add team features" roadmap I've seen starts with a server and a
database. I wanted three things a team actually asks - whose change is
this, why did it bounce back a step, how long did it sit in each step -
without either.

So people are files now: one JSON per person, one public key per machine,
and joining is just a pull request. A change's owner and implementer, and
every "sent back" with its reason, are signed events - one file per
event, so two branches never touch the same file and a merge never
conflicts. A change's stage - Proposed, Planned, In progress, In review,
Landed, Archived - is never set by a person or a button; it's read back
from dated facts: the commit that adds `tasks.md`, the PR that opens, the
PR that merges. A change can revisit a stage, and every visit is kept.

*[board.png - the real Pipeline board, not a mockup]*

Full write-up, with links to what actually shipped:
https://openspec-ui.dev/articles/a-team-works-through-git/

## Where each claim comes from

Not for posting.

- The decision and what it rules out on purpose:
  `docs/adr/0037-a-team-works-through-git.md`.
- People as files, signed history, derived stages, the board: the archived
  changes `a-team-works-through-git`, `a-change-knows-its-stage`,
  `the-board-shows-the-stages`.
- The article itself:
  `docs/articles/site/2026-09-27-a-team-works-through-git.md`.

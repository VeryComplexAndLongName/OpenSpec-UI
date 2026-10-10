## Context

ADR 0043 made every change live in a worktree of its own, on a branch named
after it. The survey pairs a directory with its change by the branch name
(`ownChange`), and a card of that change may act on it. What was missing is
the step between "made on this disk" and "on the server", and the actions
of such a card when the Pipeline is arranged by step.

## Goals / Non-Goals

**Goals:** a change, once made, is committed on its branch and pushed, by
whoever made it - an agent or the product; a card says where that has not
happened and does it with one press; a change of one's own worktree is
worked from its card in either arrangement.

**Non-Goals:** opening the pull request at creation (the git stage, or the
person, opens it when the change is ready for review: a pull request opened
at once would put the change in review on the board); changes of another
machine with no worktree here (a separate change, if wanted).

## Decisions

- **Commit everything in the change's worktree.** The worktree exists for
  the change, on the change's branch; what it holds is the change's work.
  `git add --all`, a commit where anything is staged, then a push that sets
  the upstream where the branch has none. Refused on `main`/`master` and in
  the main checkout.
- **Create Change shares what it made.** After `openspec new change`, the
  scaffold is committed (`<id>: create the change`) and pushed. A refused
  push does not undo the change; the result carries what was refused, and
  the hosts say it (`OSW-GIT-203`).
- **The git stage commits before it pushes** (`<id>: commit what the stages
  left`), recorded in the audit as a git action. Its failure fails the stage
  before any push (`OSW-GIT-103`).
- **"Not on the server" from the refs only.** The survey already lists
  `refs/heads` and `refs/remotes/origin` once; a change's branch with no
  remote ref is `never-pushed`, one at another commit is `differs`. Running
  `git status` in every worktree on every survey would cost a process per
  directory per read, which the survey avoids by design
  (the-workspace-clears-what-it-left-behind). So uncommitted files alone
  are not marked; Commit Change is offered on every own-worktree card
  anyway, and the rules and the git stage keep files from staying
  uncommitted.
- **Commit Change is an action of core's list** (ADR 0044): verb Commit
  (Set up), noun Change, its own icon `git-commit`; acts at once, so no
  dots. Refused where the change is worked in the checkout, and while a run
  of it is going (a run commits as it goes).
- **Arranged by step, as on the board.** The directory sections beneath the
  picture draw a change's own card with the same facts and actions the
  board gives it.
- **What is said is in the register** (ADR 0046): a new GIT group, so the
  ratchet of messages said in place stays at 290.

## Risks / Trade-offs

- A push asks for credentials where git has none stored → the host waits
  for git as any push does; a refusal is said with git's own words.
- "Commit everything" could commit a stray file in the worktree → the
  worktree is the change's own; the commit is on its branch, reviewed in
  its pull request.
- `differs` also reads a branch the server moved past → rare in this
  workflow; the words say "not on the server as it is here", which holds.

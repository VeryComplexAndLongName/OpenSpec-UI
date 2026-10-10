## ADDED Requirements

### Requirement: The git stage commits what the stages left

Before it pushes, the `git` stage SHALL commit everything the change's
working directory holds that is not committed, on the branch it pushes,
and record that commit as a git action. It SHALL NOT commit on the default
branch. Where the commit fails, the stage SHALL fail before any push and
say why (`OSW-GIT-103`).

#### Scenario: Work left uncommitted

- **WHEN** the `git` stage starts on branch `add-cart` and the stages left
  files uncommitted
- **THEN** they are committed as "add-cart: commit what the stages left"
  before the branch is pushed

#### Scenario: The commit fails

- **WHEN** git refuses that commit
- **THEN** the stage fails with "git stage failed at commit" and git's
  words, and nothing is pushed

### Requirement: A change's own worktree is committed and pushed in one action

Commit Change SHALL commit everything a change's own worktree holds on the
change's branch and push the branch, setting its upstream where it has
none. It SHALL be refused, committing nothing, where the change has no
worktree of its own (`OSW-GIT-001`) and where that worktree is on the
default branch (`OSW-GIT-002`). A refused push SHALL leave the commit made
and say the server's words (`OSW-GIT-102`). Both hosts SHALL say the
result through the same function in core.

#### Scenario: A change made and never committed

- **WHEN** Commit Change is chosen for `demo`, whose worktree holds its
  files untracked on a branch never pushed
- **THEN** they are committed on `demo`, the branch is on the server with
  `origin/demo` as its upstream, and nothing of `demo` is on `main`

#### Scenario: A change in the checkout

- **WHEN** Commit Change is asked for a change with no worktree of its own
- **THEN** nothing is committed, and the answer is `OSW-GIT-001`

## MODIFIED Requirements

### Requirement: Every agent is told how work is done in the repository

The product SHALL write a section between its own markers into `CLAUDE.md`
and `AGENTS.md` saying that each OpenSpec change is worked in a git
worktree of its own at `<worktree root>/<repository>/<change-id>`, on a
branch named after the change cut from `origin/main`, with the rule for
the root and the commands that make it, and that the stage assignment is
in `openspec/agent-harness.json` and a change's `harness.json`, a stage
named for another agent being handed back. It SHALL also say when a
change is committed and pushed: its planning artifacts on its branch, with
the branch pushed and its upstream set, as soon as they are written; the
work of every task ticked, with its `tasks.md`; nothing left uncommitted or
unpushed at the end of a turn; nothing of a change on the default branch;
and a refused push said, not worked around. It SHALL create a file that is
missing, rewrite the section in place where it is, and add it to the end
of a file without it that somebody else wrote only where the person said
so; it SHALL NOT change anything else in a file.

#### Scenario: A repository with OpenSpec's own AGENTS.md

- **WHEN** the rules are written where `AGENTS.md` exists without the
  section and `CLAUDE.md` does not exist, and the person declines
- **THEN** `CLAUDE.md` is created with the section and `AGENTS.md` is left
  as it was, and the result names it

#### Scenario: Told when, not only where

- **WHEN** an agent reads the rules
- **THEN** they say to commit the planning artifacts and run `git push -u
  origin <change-id>` as soon as they are written, and to commit and push
  after every task ticked

### Requirement: A new change is made in a working directory of its own

A working directory SHALL be made for a change that exists nowhere yet;
one SHALL still be refused for a change that exists only as uncommitted
files in the main checkout. Making a new change through the product SHALL
fetch, cut its own directory from `origin/main` on a branch named after
it, run `openspec new change` there, commit the change on its branch and
push the branch with its upstream set. A refused push SHALL leave the
change made, and the host SHALL say why the server does not have it
(`OSW-GIT-203`). In a repository with no `origin` the change SHALL be made
in the workspace as before.

#### Scenario: Create in a repository with a remote

- **WHEN** a change `add-cart` is created in a repository `shop` with an
  `origin`
- **THEN** `../.worktrees/shop/add-cart` exists on branch `add-cart` cut
  from `origin/main`, the change is in it, not in the checkout, and the
  branch is on the server with the change committed

#### Scenario: The push is refused

- **WHEN** the push of the new change's branch is refused
- **THEN** the change is made in its directory, and the host says it is
  not on the server, and why

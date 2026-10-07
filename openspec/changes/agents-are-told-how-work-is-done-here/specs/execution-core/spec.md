## ADDED Requirements

### Requirement: Every agent is told how work is done in the repository

The product SHALL write a section between its own markers into `CLAUDE.md`
and `AGENTS.md` saying that each OpenSpec change is worked in a git
worktree of its own at `<worktree root>/<repository>/<change-id>`, on a
branch named after the change cut from `origin/main`, with the rule for
the root and the commands that make it, and that the stage assignment is
in `openspec/agent-harness.json` and a change's `harness.json`, a stage
named for another agent being handed back. It SHALL create a file that is
missing, rewrite the section in place where it is, and add it to the end
of a file without it that somebody else wrote only where the person said
so; it SHALL NOT change anything else in a file.

#### Scenario: A repository with OpenSpec's own AGENTS.md

- **WHEN** the rules are written where `AGENTS.md` exists without the
  section and `CLAUDE.md` does not exist, and the person declines
- **THEN** `CLAUDE.md` is created with the section and `AGENTS.md` is left
  as it was, and the result names it

### Requirement: A new change is made in a working directory of its own

A working directory SHALL be made for a change that exists nowhere yet;
one SHALL still be refused for a change that exists only as uncommitted
files in the main checkout. Making a new change through the product SHALL
fetch, cut its own directory from `origin/main` on a branch named after
it, and run `openspec new change` there; in a repository with no `origin`
it SHALL be made in the workspace as before.

#### Scenario: Create in a repository with a remote

- **WHEN** a change `add-cart` is created in a repository `shop` with an
  `origin`
- **THEN** `../.worktrees/shop/add-cart` exists on branch `add-cart` cut
  from `origin/main`, and the change is in it, not in the checkout
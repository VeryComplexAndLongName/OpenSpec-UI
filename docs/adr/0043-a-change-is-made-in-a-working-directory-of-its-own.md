# 0043: A Change Is Made in a Working Directory of Its Own, and Every Agent Is Told So

Status: Accepted

Date: 2026-10-07

Amends [ADR-0022](0022-changes-run-side-by-side.md) decision 3.

## Context

The owner, on 2026-10-07: agents creating a change make it in the
current folder, on the current branch, in every repository other than
this one, "and it is a mess". This repository's own agents work each
change in a worktree only because its instructions and their memory say
so. Nothing this product writes into a repository said it: the block
"Generate Agent Instructions" writes into `CLAUDE.md` and `AGENTS.md`
held Node and Python style notes, and was not offered at all where both
files existed, which after `openspec init` is usual. An agent started in
a person's own terminal reads those files and nothing of this product's
configuration, so it learnt neither where a change is worked nor which
agent does which stage.

The product itself did the same. "Create OpenSpec Change" wrote the
change into the checkout it had open, and a working directory could be
made for a change only once it was committed to the base (ADR-0022
decision 3), so the order was always "in the checkout first".

## Decision

1. **The rules are written into the repository, for every agent.** A
   section of its own in `CLAUDE.md` and `AGENTS.md`, between its own
   markers, says: each change is worked in a git worktree of its own at
   `<worktree root>/<repository>/<change-id>`, on a branch named after the
   change cut from `origin/main` as the server has it; the root is told as
   the rule ADR-0027 gives (environment, settings, then `../.worktrees`),
   since the file is committed and the root differs from machine to
   machine; the commands that make it, with and without this product's
   CLI; and that the stage assignment is in `openspec/agent-harness.json`
   and a change's `harness.json`, and a stage named for another agent is
   not done but handed back. Since a change is cut from the server's
   default branch, the rules also say that the OpenSpec setup must be
   there first: committing and pushing it is the one thing done in the
   checkout.
2. **It is written when a repository is initialized**, in both hosts, and
   on demand ("Write Agent Workflow Rules"). A file that does not exist is
   created; the section is rewritten in place where it is; a file somebody
   else wrote gets it at its end only where the person says so - asked in
   the editor, a checkbox on the standalone's page - and is otherwise left
   as it was, and said.
3. **A working directory may be made for a change that exists nowhere
   yet** (amending ADR-0022 decision 3). The refusal stays where it was
   needed: a change that exists only as uncommitted files in the main
   checkout still refuses, since the directory would hold nothing of it.
4. **The product makes a new change in its own working directory.**
   "Create OpenSpec Change" in both hosts fetches, cuts the change's
   directory from `origin/main` and runs `openspec new change` there. A
   repository with no `origin` has no server branch to cut from, and the
   change is made where it always was.
5. **The standalone's page may work in the repository's own working
   directories.** Its `cwd` policy allowed only the workspace; it now also
   allows `<worktree root>/<repository>/`, read once at start, so the
   page can open the change it just made. Another repository's directory
   is still refused.

## Consequences

- An agent in any repository initialized by this product is told where a
  change is worked and who does which stage, whatever started it.
- The Changes view of the main checkout no longer lists a change just
  made: it lives in its own directory until it lands, as the Pipeline
  already shows (ADR-0029).
- A repository initialized before this has no section until "Write Agent
  Workflow Rules" is run there.

## Alternatives considered

- **Write the absolute worktree path.** Rejected: the file is committed,
  and the path is of one machine.
- **Append to a person's file without asking.** Rejected: the files are
  theirs, and the existing rule of this product is that a file without
  its marker is not touched. Asking keeps that rule and lets them say yes.
- **Keep the product's own "Create" in the checkout.** Rejected: the
  product would break the rule it tells every agent to keep.
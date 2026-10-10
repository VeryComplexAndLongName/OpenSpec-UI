# 0044: The Pipeline Is Where Changes Are Worked, and the Side Panel Becomes the Workspace

Status: Accepted

Date: 2026-10-08

## Context

Since ADR 0043, a change is made in a working directory of its own. The
Changes tree in the VS Code side panel draws such a change as one worked
"elsewhere", and offers it a shortened menu: no **Configure Harness for
this Change**, no **Run...**, no **Archive**, **Rollback** or **Delete**,
no relations. A change in its own worktree - now the usual change - can
have its own `harness.json` set nowhere but in the file. The owner noticed
it on 2026-10-08.

The Pipeline already draws every change, in the checkout or in a worktree,
as a card, in both hosts. The standalone app has no side panel at all: its
cards are the only place a change is worked. Each control added to the
tree and not to the card, or the other way round, made one host or one
kind of change poorer than another.

## Decision

1. **The card is where a change is worked.** Every action on a change is
   offered on its card, wherever the change lives - the checkout's branch
   or a worktree. Where it lives is shown on the card (its colour and
   label, as now), and decides only where the action runs, never whether
   it is offered.
2. **Every action the card offers comes from one list in core** (ADR
   0045). The Changes tree, while it remains, offers the same actions from
   the same list; neither surface has an action the other lacks.
3. **The side panel becomes the Workspace.** It holds what is about the
   workspace rather than about one change: the global harness settings
   and agents, the Human-Only Inbox, Specs, the Archive and Templates. Its
   list of changes becomes a navigator - selecting a change opens its
   card in the Pipeline, or its files - rather than a second place to act
   on it.
4. **In steps.** First the actions reach the card and the tree from one
   list; then the side panel takes its new shape in a change of its own.

### Amended on 2026-10-09 (the-side-panel-is-the-workspace)

Step 2, as the owner approved it on 2026-10-09:

- The side panel's views are, in order: **Workspace**, Human-Only Inbox,
  Changes, Specs, Archive, Templates, Processes and Change Graph, the last
  two folded at first. The Workspace view holds Open Pipeline, Open
  Dashboard, the Workspace Harness, **Agents** (each agent found or not,
  its version, the stages the workspace harness gives it), OpenSpec
  Configuration, Repository Setup and the declared checks.
- Choosing a change in Changes shows its card in the Pipeline: scrolled
  to, marked for a moment and focused. A change worked only in another
  working directory has a row of its own that does the same; before, it
  was one line counting such changes.
- A change's menu is **Show Actions...** alone; the actions it lists are
  the card's. Its files stay beneath its row.
- Open Dashboard stays in the Changes title as well, where people found
  it. The Change Graph keeps its own menus: they state relations between
  changes, which is what that view is for.

## Consequences

- A change's own harness, its run and every other action are reachable
  for a change in a worktree, in both hosts.
- The two hosts offer the same actions on a change by construction.
- The Changes tree loses its menus' role; users who worked from it work
  from the card, or from the tree's one **Actions...** entry while it
  remains.

## Alternatives considered

- **Give the "elsewhere" rows the full menu again.** Rejected: it fixes
  the tree and leaves the standalone app, which has no tree, as it is, and
  keeps two places to maintain.
- **Remove the side panel.** Rejected: the Inbox, Specs, Archive and the
  global settings belong to no change, and a native tree serves keyboard
  users and quick file opening well.

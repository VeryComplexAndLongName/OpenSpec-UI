---
title: How a shipped change came back to the board
summary: A pull request restored an archived OpenSpec change and an old worktree drew it again. The merge gate and the Pipeline handle each case.
cover: cover.png
cover_alt: The blue OpenSpec Workbench owl looks back over its shoulder with an archive folder beside the article title.
---

On 10 October 2026, the change that put the CLI on the Workbench homepage moved to the OpenSpec archive. Eight minutes later, another pull request added the same change back under `openspec/changes/`, with all its boxes open. The merge gate passed. The Pipeline drew a card for unfinished work that had already shipped.

An OpenSpec change can be valid in isolation while contradicting the history on the target branch. That history was the missing input.

## Compare the change with its base

The merge gate already compared recorded people and history against the pull request's base. It now also compares the active change IDs in the proposed tree with the archived IDs on that base. When it finds the same ID, it names the change and the archive folder.

This comparison allows the usual archive pull request. In that case, the base still holds the active change, and the proposed tree moves it into the archive. The check is for an active copy reintroduced after the base already archived it.

You can run the same comparison locally on a proposed branch. Refresh the base ref first so it includes recent archives.

```bash
git fetch origin
openspec-ui-cli validate changes --base origin/main --format text
```

## A second copy can come from a checkout

Three days later, two dashed cards on the Pipeline led to a detached worktree left behind after an upstream check. Its commit was already reachable from the default branch. One of the cards showed the same shipped change with zero completed tasks. This time the extra copy was on disk in an old checkout.

The worktree survey now recognizes a clean detached directory whose commit is contained in the default branch, provided no run is recorded against it. The Pipeline offers the directory for removal under **Left behind**. The operator decides whether to remove it. A detached directory at the default branch's tip may also be a workspace someone just prepared.

If a shipped card reappears, inspect its checkout. A stale directory calls for a worktree decision. A pull request bringing the folder back calls for a correction to the proposed tree. The two incidents are recorded in [the merge-gate change](https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/909) and [the detached-worktree change](https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/915).

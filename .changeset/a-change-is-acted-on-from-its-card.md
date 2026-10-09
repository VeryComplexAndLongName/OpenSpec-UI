---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

**A change is acted on from its card** (a-change-is-acted-on-from-its-card, ADR 0044). A change's card in the Pipeline now offers every action on the change, from one list in core: under its name, in two rows of icons grouped and coloured by kind - what runs, what reads, what sets up, and what cannot be taken back - each the icon its command has in VS Code's menus. An action that cannot run now is dimmed and says why; Archive, Rollback and Delete ask first. An action runs where the change is worked: a change in its own worktree is configured, archived, related or deleted there, rather than refused - only a directory whose records do not check out is still refused. In VS Code the card runs the same command a Changes row does, and the Changes tree's menu now opens with **Show Actions...** (also an icon on the row), then what runs, **Inspect** and **Set Up** submenus, and the Danger actions last; a change worked in another worktree offers everything, with a branch icon instead of a lock. In the standalone app every action works too, through one server route, with a dialog over the Pipeline; a change's harness settings are read and written where the change is worked.

---
"openspec-ui-vscode": minor
"@openspec-ui/webui": minor
---

**The side panel is the Workspace** (the-side-panel-is-the-workspace, ADR 0044). A new **Workspace** view comes first: Open Pipeline and Open Dashboard, the Workspace Harness, **Agents** - each agent the product knows, whether it is found on this machine, its version and the stages the harness gives it - OpenSpec Configuration, Repository Setup, and Run Typecheck, Run Tests and Run Lint where the workspace declares them. The Human-Only Inbox follows, then Changes; Processes and the Change Graph start folded. **Changes is a list to go by**: choosing a change shows its card in the Pipeline, scrolled to, marked for a moment and focused, and a change worked only in its own worktree now has a row of its own. A change's right-click menu is **Show Actions...** alone, which lists every action its card offers; Run, Stop, the Inspect and Set Up submenus, Archive, Rollback and Delete are there and on the card.

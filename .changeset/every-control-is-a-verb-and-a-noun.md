---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

**Every button is a verb and a noun** (every-control-is-a-verb-and-a-noun, ADR 0045). The buttons of the Pipeline, the cards, the run and chain panels, the AI panel, the task list, Processes, the harness settings and the standalone app follow the rule the commands already did: **Run Change...** for Start..., **Show Logs** for Logs, **Update Main** for Catch up, **Show Landed Changes** for Show them, **Show Tasks** and **Hide Tasks** for Open all and Close all, **Stop Run...** and **Stop Process** for Stop... and Stop now, **Confirm Key** for It was me, **Delete History...** for Clean old history, and the rest. Inside a dialog that already names what it is about, a button is the verb alone: Answer, Allow, Deny, Archive, Delete, Cancel. Archive Landed Changes..., Delete History..., Rollback Process..., Delete Leftover... and Delete Worktree... now ask in a dialog before anything is deleted. A test reads every button's words and holds them to the lists.

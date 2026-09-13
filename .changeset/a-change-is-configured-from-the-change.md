---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": patch
---

A change is configured from the change.

"Configure Harness for this Change" opened a view that showed the global settings first, a change name field under the global save button, and nothing else: the panel learned the change's name after the view had mounted, and the view read its name only once. Global settings and a change's own settings are now two views, each about one file, and each opened where it belongs.

- The global view has no change name field and nothing about any one change. Beside its autonomy level it says that `autonomous` is set for a single change.
- A change's view reads the change's name as it is given, loads that change's `harness.json` with nothing typed, and names on each inherit option the value it resolves to and where from. In the standalone app it is the Change Editor's new **Harness** tab; in VS Code, "Configure Harness for this Change" opens a panel of its own per change, titled `Harness: <change>`, and "Configure Harness Settings" opens one for the global file. The AI panel no longer mounts a settings view.
- In both views the save is disabled until a field differs from what was loaded, and "Unsaved changes" says so while one does. The named configuration block and the fields are separate sections, drawn apart.
- Named configurations are chosen from one list, in both views and in the run dialog: a select, the chosen configuration's description beneath it, and **Apply**. What applying did is said beside the button; in VS Code the run dialog no longer raises a notification for it.
- A recommendation drawn from past runs can be applied: the run dialog offers "Use `<agent>` for every stage". Core gains `agentForEveryStageToWrite`, which sets every stage to the agent and drops an effort, budget unit or custom agent the new agent does not accept.

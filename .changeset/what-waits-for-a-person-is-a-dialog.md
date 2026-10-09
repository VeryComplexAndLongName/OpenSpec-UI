---
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

**What waits for you is a dialog** (what-waits-for-a-person-is-a-dialog, ADR 0047). Answering an agent's questions, giving a Stop its reason, confirming Archive, Rollback or Delete, a task shown whole and a run's logs now open as a modal dialog over the whole view, rather than as a form below the Pipeline: the view behind is dimmed and cannot be pressed, the focus moves into the dialog and stays there, and Escape or Cancel closes it - a stray click beside it does not. The top of the Pipeline now says what waits for you, whatever the number of changes - each change whose agent asks, with **Answer...**, and each permission a run here waits on, with **Allow** and **Deny** - and stays in sight as the picture scrolls; an agent's question never opens a dialog by itself, so it cannot take your typing mid-word. The run and chain panels put what their run waits for first. In the standalone app the run dialog, the chain and a change's actions open the same way.

---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

A Pipeline card opens to its tasks.

- A checklist item records the `## ` section it is listed under. The survey carries every item of a change's task list as a row, with its number, section and who may close it. `describeTaskRows` gives each row one word: done, in hand, probably next, open, only a person can close it, or delegated to an agent.
- `Show tasks` and `Hide tasks` open a card to list its rows under their headings. A thin rail joins each row to the next, and the row a run is on stands out in words and weight. `Open all` and `Close all` sit above the picture, and a legend says what each kind of line means.
- An open card's height is derived (`pipelineOpenCardHeight`), and `layoutChanges` stacks each column by the cards' heights. Opening a card moves only the cards below it, and every edge still meets a card at its head.
- The picture zooms through 75%, 90%, 100%, 125% and 150%, and every length on a card scales with it. Each host remembers the zoom and the open cards: the standalone shell in `localStorage`, and the editor's Pipeline panel in its webview state.

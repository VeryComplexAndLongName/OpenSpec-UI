---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

The Pipeline picture's first column is headed "Step 1 - waits for nothing"
instead of "can start now". The old words read, over a change with every
task done, as advice to start it again; the column only ever meant that
nothing active blocks its changes. The other columns read "Step N - after
step N-1", with a plain hyphen where a middle dot was.
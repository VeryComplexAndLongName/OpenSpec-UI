---
"@openspec-ui/server": patch
"@openspec-ui/webui": patch
---

The standalone AI panel follows its run to the end (the-standalone-panel-follows-its-run). A run could stop showing anything after the page re-rendered - the panel subscribed again, which closed its connection - and an answer to a permission request for a run on an agent other than the default one was lost on its way; both now reach their run, as they already did in VS Code.

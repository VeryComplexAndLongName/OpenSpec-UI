---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
---

The readiness report's facts are now offered as suggestions: which ready
changes can be started alongside each other, which is ready with nowhere
to run, and which workspace is held by a run that stopped reporting
itself. Each carries the fact it came from and the exact commands, shown
in the Pipeline tab and printed by `openspec-ui-cli advise`. They create
nothing and start nothing, they name every maximal set rather than
choosing one, and `hints.enabled: false` means they are not computed at
all.

---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

The editor's Changes tree says Running while a run works on a change. It
used to say Ready until a task was ticked, the view was refreshed or five
minutes passed, because a run's status record is written outside the
workspace. The tree now watches those records while the Changes view is
visible and reads the runs again from them alone, without git, drawing a row
again only when its word changes. The standalone Changes list reads which
runs are live again every thirty seconds while the summary is shown.

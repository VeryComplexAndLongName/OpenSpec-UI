---
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

The Run dialog advises rather than claiming to. It was shipped as a path
picker: the standalone shell never recommended anything, the editor's
recommendation went into a quick-pick hint that truncates, no named
configuration could be applied from it, and a configuration with nothing
wrong rendered nothing at all.

The recommendation now appears in both hosts — the standalone shell reads
the change's open task count from `/api/change-timeline`, which it could
always do — and is shown where it can be read. The three named
configurations are offered beside it, so a recommendation is something to
act on rather than a remark; applying one writes the change's
configuration and starts nothing. A configuration whose ceilings can all
act now says so.

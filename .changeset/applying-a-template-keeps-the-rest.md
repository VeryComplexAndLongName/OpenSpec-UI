---
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

Applying a named configuration from the Run dialog no longer deletes the
change's other settings. Both hosts wrote the template as the change's
whole file, and the writer replaces — so `gitStageAllowlist`, which says
which paths a chain may stage, along with any hand-tuned ceilings, was
removed by applying a template. The template's keys are now laid over
what the change already has.

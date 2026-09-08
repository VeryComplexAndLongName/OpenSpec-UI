---
"@openspec-ui/webui": patch
---

The harness settings view no longer deletes configuration it has no
fields for. Both writers replace the file, so saving used to remove
`timeout`, `maxStageAttempts`, `budget`, `checkpoints` and
`gitStageAllowlist`. The per-change section also gains the template
picker, which is the only place the per-change-only "overnight" template
can be applied from.

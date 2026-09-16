---
"@openspec-ui/webui": minor
---

Harness Settings is laid out as ADR 0033's mockup: the named configurations as a segmented choice with "Apply to the form" beside them, what the configuration cannot do as a warning callout, and one panel with a row per stage — agent, model, effort and max cost — the autonomy level, review gate and run budget side by side under the stages, and Save and Discard at its foot. A stage's model and the run budget (`budget.maxCostUsd`) can now be set in the view, Discard reads the file again, and the page head's "agent-harness.json" shows the file as Save would write it. A change's own settings use the same layout, and a narrow panel reads each stage as a block of labelled fields.

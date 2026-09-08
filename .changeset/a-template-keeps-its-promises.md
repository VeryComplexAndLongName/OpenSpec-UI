---
"@openspec-ui/core": patch
---

The Overnight harness template now sets
`checkpoints.requireConfirmationBetweenSteps: false`, the "no checkpoints
between stages" its own description promised. Without it, a change
configured from the template still paused for confirmation between every
stage. A guard now checks each template's stated behaviour against the
configuration it applies, in both directions.

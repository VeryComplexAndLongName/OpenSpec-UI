---
"openspec-ui-vscode": minor
---

Add "OpenSpec UI: Create Change Template" — creates an OpenSpec change and,
in the same flow, optionally walks through configuring that change's
per-change Agentic Harness override (which agent handles each stage, the
autonomy level, the review gate) instead of requiring a separate
"configure harness" step afterward. Declining customization, or leaving
every question at its default, writes no per-change `harness.json` —
identical to a change created without ever running this command.

See `openspec/changes/agentic-harness-change-template/` for the full
design.

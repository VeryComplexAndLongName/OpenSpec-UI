---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

One entry starts a run, and it shows what the configuration resolves to
before starting: which path will run and why, which agent each stage will
use, any ceiling that cannot act, and — where the host can read the
change's task list and audit log — the recommended configuration with the
observations behind it.

**Implement with VS Code Agent** is gone as a menu entry and is now a
choice inside that dialog. It was never a separate way of working:
`vscode-chat` is already a step agent, so that path is the `apply` stage
run by it. Choosing any path other than the configured one applies to
that run alone and writes nothing to `harness.json`.

New in core: `buildRunPlan`, `agentForChosenPath`, and the `RunPlan` /
`RunPath` types. New in webui: the `RunDialog` component.

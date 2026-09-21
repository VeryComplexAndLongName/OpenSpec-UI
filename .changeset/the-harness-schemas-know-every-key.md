---
"@openspec-ui/core": patch
"openspec-ui-vscode": patch
---

The editor no longer marks a correct harness file as wrong

VS Code checks `openspec/agent-harness.json` and each change's
`harness.json` against schemas the extension ships. Those schemas knew 4
of the 14 settings and marked the rest as errors: `budget`, `timeout`,
`branches`, `archive`, a stage's agent written with a model or an effort,
and the ACP agents among them. They are now built from the same rules the
product enforces, so the editor marks what the product would refuse and
nothing else, and most settings say what they do when hovered.

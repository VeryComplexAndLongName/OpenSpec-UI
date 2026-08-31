---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Make the Agentic Harness's `semi-autonomous`/`autonomous` autonomy levels
functional. A new `"chain"` command runs `propose -> review -> apply ->
archive` for a change in sequence, pausing at an explicit `checkpoint`
between stages by default (`semi-autonomous`) or continuing immediately via
`stageCompleted` (`autonomous`, or a per-change `harness.json` setting
`checkpoints.requireConfirmationBetweenSteps: false`). `autonomous` is
reachable only through an explicit per-change `openspec/changes/<id>/
harness.json` — never the global `openspec/agent-harness.json`, and never
implied by any other setting.

See `docs/adr/0012-agentic-harness-chain-execution-protocol.md` and
`openspec/changes/agentic-harness-autonomy/` for the full design. A chain
always stops after `archive` and never invokes the `git` stepAgent —
commit/push automation remains fully out of scope, deferred to its own
future change. The "Run with Agentic Harness" UI entry point that starts a
chain from either delivery target is also a separate, dependent follow-up
(`openspec/changes/agentic-harness-run-menu/`); this release only adds the
protocol and a minimal, not-yet-wired-up `HarnessChainPanel` component.

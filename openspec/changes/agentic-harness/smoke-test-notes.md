# Smoke test — agentic-harness (Phase 1: assisted level)

## Real Extension Host run

`npm run test:integration --workspace openspec-ui-vscode`: **10/10 passing**,
including two new live tests against the real, registered
`ChangesTreeProvider` and real command handlers (not a mocked `vscode`
module):

- "Harness Settings: global command creates openspec/agent-harness.json
  with the documented default and opens it" — executes the real
  `openspec-ui.configureHarness` command, reads the file back from disk
  with `vscode.workspace.fs.readFile`, confirms it matches
  `DEFAULT_HARNESS_CONFIG` exactly, confirms it's genuinely open in a
  visible editor, and confirms the "Harness Settings" tree item is
  present at the Changes tree root with the right `contextValue`/command.
- "Harness Settings: per-change command creates
  openspec/changes/<name>/harness.json and opens it" — finds the
  fixture's real "demo" change via the real tree, executes
  `openspec-ui.configureHarnessForChange` with that real tree item,
  confirms the written file is `{}` (an empty override — inherit
  everything), and confirms it's open in an editor.

## Full workspace verification

- `npm run typecheck`/`lint`/`test` clean for `core`, `server`, `webui`,
  `extension` — 151/151 (extension), 188/188 (webui), full core suite,
  full server suite except two known-flaky, pre-existing Windows temp-
  directory-cleanup races in the *unrelated* WebSocket describe block
  (`EBUSY`/`ENOTEMPTY` on `rmdir` — reproduced in isolation, unaffected
  by anything in this change, non-deterministic count across repeated
  runs; not touched by this change's diff).
- `packages/core/src/harness-config.test.ts`: 13/13 — default-when-
  missing, partial-key merge, global `agent-sufficient` rejected at both
  write time and read time (a hand-edited file), round-trip write/read.
- `packages/server/src/server.test.ts` (new): 5/5 real HTTP-server tests
  for `/api/harness-config/{resolve,read-change-override,write}` against
  real temp workspaces on disk (no core-layer mocking).
- `packages/webui/src/harness-config-client.test.ts`: 8/8.
- `packages/webui/src/components/HarnessSettingsView.test.tsx`: 7/7,
  including the specific regression this design cared about: an
  unset per-change field renders as "(inherit)", not silently defaulting
  to a real agent id, and saving only sends the explicitly-set fields.
- `packages/webui/src/components/AiPanel.test.tsx` (+4 new): pre-fill
  behavior, including that a user's manual agent pick for a command kind
  is never overwritten by a later pre-fill for that same kind.
- `packages/webui/src/components/ProcessesView.test.tsx` (+2 new) and
  `packages/extension/src/tree/processes-tree.test.ts` (+4 new): agentId
  and percent-complete display, confirming percent comes from
  `completedTasks`/`totalTasks`, not the free-text `progress` field.
- `packages/extension/src/webview/ai-panel.test.ts` (+9 new): the
  `trackHarnessProcess` observer wrapper (registers a `WorkbenchProcess`
  for `plan`/`implement`/`review` without changing how the run itself
  executes or cancels) and the `resolveAndPostStepAgents` follow-up
  context message.

## Scope actually delivered vs. tasks.md

Task group 2 ("`WorkbenchProcess.agentId` and percent-complete") turned
out to require more than the field addition tasks.md anticipated: neither
the VS Code AI panel's `plan`/`implement`/`review` runs (via
`run-controller.ts`) nor the standalone `plan`/`review` runs (via
`websocket.ts`, non-mutating) were previously registered in
`WorkbenchProcessScheduler` at all — only `implement` was, through a
separate path (`WorkbenchRecoveryService.runMutating`). Delivered:

- VS Code: a new observer wrapper (`AiPanel.trackHarnessProcess`) that
  registers a scheduler process for `plan`/`implement`/`review`, purely
  watching the existing event stream — no change to how the run itself
  executes, cancels, or streams to the webview.
- Standalone: `agentId` is now threaded through `websocket.ts`'s existing
  `runMutating` call for `implement` (the only kind already scheduler-
  tracked there).
- Standalone `plan`/`review` (non-mutating) remain unregistered in the
  scheduler — same gap that already existed before this change, not
  widened or narrowed by it. Flagged in design.md's "Non-Goals" implicitly
  via scope, called out explicitly here for whoever picks up the next
  harness-related change.

Everything else matches tasks.md's plan exactly. `semi-autonomous`,
`autonomous`, the `git` stepAgent's actual commit/push action, and
parallel task execution remain entirely unimplemented, as scoped.

Mark each task `[x]` as soon as its own check passes — not in one batch
at the end, and never before the work is actually done.

Path this change must hold end to end: `harness.json` → validation in
`harness-config.ts` → the host resolving the stage → either
`workbench.action.chat.open` (VS Code) or a refusal (standalone) → the
hand-off event reaching the panel. Check each junction, not only the
ends.

## 1. Config shape and validation

- [x] 1.1 `packages/core/src/harness-step-agent.ts`: add
  `dispatch?: "cli" | "vscode-chat"` to the object form of
  `HarnessStepAgent`, and return it from `normalizeStepAgent` alongside
  `agent`/`model`, defaulting to `"cli"` when absent.
- [x] 1.2 `packages/core/src/harness-config.ts`, `assertValidStepAgents`:
  reject a `dispatch` value that is neither `"cli"` nor `"vscode-chat"`,
  with a message naming the stage.
- [x] 1.3 `packages/core/src/harness-config.ts`: reject
  `dispatch: "vscode-chat"` when the resolved `autonomyLevel` is not
  `assisted`, with a message naming the stage and saying a chain cannot
  use it. Note this needs the autonomy level, which
  `assertValidStepAgents` does not currently receive — thread it in
  rather than reading it from module state.
- [x] 1.4 `packages/core/src/harness-config.ts`: do **not** add any
  delivery-target check here. Core does not know which host loaded it —
  see design.md, "Validation splits between core and the host".

## 2. Protocol

- [x] 2.1 `packages/core/src/protocol.ts` line ~72: add one non-terminal
  `EventKind` member for a stage handed to the host's chat, and its
  event interface alongside the existing ones. Keep
  `completed`/`failed`/`cancelled` as the only terminal kinds.
- [x] 2.2 `packages/core/src/protocol.ts`: include the new kind in
  `isEvent()`'s recognised set, the same way `stageCompleted`/
  `checkpoint` are.

## 3. VS Code dispatch

- [x] 3.1 `packages/extension/src/webview/ai-panel.ts`: when a command
  arrives for a stage whose resolved `dispatch` is `"vscode-chat"`, do
  not call the `AgentRunner`. Build the prompt the same way
  `commands.ts`'s `startImplementation` does (reuse it — do not write a
  second prompt builder), call `vscode.commands.executeCommand(
  "workbench.action.chat.open", { query, mode: "agent" })`, and post
  `started` followed by the new hand-off event.
- [x] 3.2 `packages/extension/src/webview/ai-panel.ts`: emit no
  `completed`/`failed` for such a stage — see design.md, "A distinct
  event kind, not `completed`". The run ends after the hand-off event.

## 4. Standalone refusal

- [x] 4.1 `packages/server`: where the harness config is resolved for the
  standalone client, reject a stage whose `dispatch` is `"vscode-chat"`
  with a clear error naming the stage — do **not** silently fall back to
  `"cli"`, which would run an expensive CLI the user did not ask for.

## 5. Tests

- [x] 5.1 `harness-config.test.ts`: the bare-string and
  `{ agent, model }` forms still resolve exactly as before, with
  `dispatch` defaulting to `"cli"`.
- [x] 5.2 `harness-config.test.ts`: an unknown `dispatch` value is
  rejected at config read, naming the stage.
- [x] 5.3 `harness-config.test.ts`: `vscode-chat` with
  `autonomyLevel: semi-autonomous` and with `autonomous` are both
  rejected, one case each; with `assisted` it is accepted.
- [x] 5.4 `packages/extension/src/webview/ai-panel.test.ts`: a
  `vscode-chat` stage calls `workbench.action.chat.open` and never calls
  the `AgentRunner` mock.
- [x] 5.5 `packages/extension/src/webview/ai-panel.test.ts`: such a stage
  posts `started` then the hand-off event, and no `completed`.
- [x] 5.6 `packages/extension/src/webview/ai-panel.test.ts`: a stage with
  no `dispatch` still goes through the `AgentRunner` exactly as today.
- [x] 5.7 `packages/server`'s tests: resolving a `vscode-chat` stage
  fails with an error rather than running a CLI.
- [x] 5.8 `protocol.test.ts`: `isEvent()` accepts the new kind, and the
  terminal-kind set is unchanged.

## 6. Verification

- [x] 6.1 `openspec change validate --strict harness-stage-dispatch`.
- [x] 6.2 `npm run typecheck`/`lint`/`test` for `@openspec-ui/core`,
  `@openspec-ui/server`, `@openspec-ui/webui`, `openspec-ui-vscode` —
  all green, including `server/src/static.test.ts`. Note:
  `sprint-report.test.ts` and `change-timeline.test.ts` have pre-existing
  Windows timeout flakes under load; do not attempt to fix them here.
- [x] 6.3 `openspec/specs/agentic-harness/spec.md` and
  `openspec/specs/execution-core/spec.md` deltas are already written in
  this change's `specs/` directory — confirm they match what was
  implemented; do not rewrite them.
- [x] 6.4 Version bump via `npx changeset` (`@openspec-ui/core` minor —
  new config field and a new event kind, backward compatible).
- [ ] 6.5 `docs/adr/README.md`: add the ADR 0016 row to the index. **Only
  once the concurrent uncommitted edits to that file have been
  committed** — otherwise committing it would sweep up another session's
  work. ADR 0015's row is owed too and is blocked on the same thing.
- [ ] 6.6 **Human-only, cannot be completed by an implementing agent**:
  rebuild and reinstall (`npm run reinstall:local --workspace
  openspec-ui-vscode`), reload the window, set a change's `apply` stage
  to `{ "agent": "claude-cli", "dispatch": "vscode-chat" }` with
  `autonomyLevel: assisted`, run it, and confirm the VS Code chat opens
  with the prompt and the panel shows the stage as handed off rather
  than completed. Leave unchecked if you are an agent.

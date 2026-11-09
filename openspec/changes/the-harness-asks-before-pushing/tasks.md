## 1. Configuration and protocol

- [ ] 1.1 Add `requirePushApproval` to `HarnessGitStageAllowlist` and validate it in `packages/core/src/harness-config.ts`.
- [ ] 1.2 Cover explicit true, false, an invalid value, and the omitted option in `packages/core/src/harness-config.test.ts`.
- [ ] 1.3 Expose the per-change option in the generated schema from `packages/core/src/harness-config-schema.ts`.
- [ ] 1.4 Define the optional `PermissionRequestEvent.pushApproval` payload in `packages/core/src/protocol.ts` while preserving the existing description and resolution command.

## 2. Prepare, approve and execute the push

- [ ] 2.1 Add `prepareSingleRefPush` to `packages/core/src/git.ts` to bind a source commit, effective push endpoint and full destination ref to one normal push.
- [ ] 2.2 In `packages/core/src/git.test.ts`, verify against local bare remotes that `prepareSingleRefPush` updates only the pinned ref and rejects an ambiguous endpoint. Cover configured follow-tags, submodule recursion and mirror mode.
- [ ] 2.3 Make `HarnessChainRunner.runGitStage` in `packages/core/src/harness-chain-runner.ts` wait for a one-use approval for the prepared push and recheck it before dispatch. Record each authorization outcome with a redacted destination and expire pending requests on cancellation or stop.
- [ ] 2.4 In `packages/core/src/harness-chain-runner.test.ts`, verify that an autonomous run asks without a question marker and an allowed request dispatches exactly once. Cover deny, cancellation, stale or mismatched IDs, destination and policy drift, an unlisted destination and the legacy path.
- [ ] 2.5 Add audit coverage in `packages/core/src/harness-chain-runner.test.ts` for the recorded request, decision, invalidation and attempt, including credential redaction.

## 3. Operator surfaces

- [ ] 3.1 Route `PermissionRequestEvent.pushApproval` through the interactive prompt in `packages/cli/src/run-change.ts`. Cancel the pending request and report failure when the prompt is unavailable.
- [ ] 3.2 Cover Allow, Deny and a missing prompt for a Harness push in `packages/cli/src/run-change.test.ts`.
- [ ] 3.3 In `packages/server/src/wire.test.ts`, verify that the WebSocket event preserves the optional push details and the resolution command accepts the original run ID, request ID and choice.
- [ ] 3.4 In `packages/extension/src/pipeline-run-control.test.ts`, verify that a Harness push resolution reaches the owning chain with the original request ID.
- [ ] 3.5 In `packages/webui/src/components/HarnessChainPanel.test.tsx`, verify that the permission controls show the commit and destination from the request and submit the choice for that request.
- [ ] 3.6 In `packages/webui/src/components/PipelineView.test.tsx`, verify that the card surfaces the waiting push description and routes an Allow decision for the original request.
- [ ] 3.7 Document the option, exact scope and terminal behavior in `HARNESS.md`.

## 4. Verify and release

- [ ] 4.1 Run only the named Vitest files from sections 1 to 3 and record the commands and results here. Full verification runs in pull-request CI.
- [ ] 4.2 Run `openspec change validate --strict the-harness-asks-before-pushing` and record the result.
- [ ] 4.3 Add a minor Changesets entry for `openspec-ui-vscode`, `@openspec-ui/server`, and `@openspec-ui/cli` using the proposal's Changelog copy and verify it survives release-note parsing with `node --test scripts/release-notes.test.mjs`.

## 1. Configuration and protocol

- [x] 1.1 Add `requirePushApproval` to `HarnessGitStageAllowlist` and validate it in `packages/core/src/harness-config.ts`.
  The targeted harness-config file passed all 208 cases, including the per-change round trip.
- [x] 1.2 Cover explicit true, false, an invalid value, and the omitted option in `packages/core/src/harness-config.test.ts`.
  The harness-config tests cover true, false, omission and a non-boolean on disk.
- [x] 1.3 Expose the per-change option in the generated schema from `packages/core/src/harness-config-schema.ts`.
  The schema generator updated change-harness.schema.json. The global schema has no content diff.
- [x] 1.4 Verify the generated extension schema in `packages/extension/src/harness-schemas.test.ts`.
  The generated schema test file passed all 8 cases.
- [x] 1.5 Define the optional `PermissionRequestEvent.pushApproval` payload in `packages/core/src/protocol.ts` while preserving the existing description and resolution command.
  The wire contract round-tripped the push scope and the affected TypeScript projects passed.

- [x] 1.6 Verify the generated message documentation and stable identifiers with `packages/core/src/message-register.test.ts`.
  The message register passed all 7 cases, including generated documentation and stable identifiers.

## 2. Prepare, approve and execute the push

- [x] 2.1 Add `prepareSingleRefPush` to `packages/core/src/git.ts` to bind a source commit, effective push endpoint and full destination ref to one normal push.
  The isolated Git fixture sent the approved SHA to exactly one ref on the first bare remote.
- [x] 2.2 In `packages/core/src/git-client.ts`, scope the URL rewrite opt-in to the approved-push Git instance.
  The isolated Git test exercised the scoped rewrite. The ordinary Git instance retains its existing unsafe options.
- [x] 2.3 In the isolated `packages/core/src/git.push.test.ts` project, verify against local bare remotes that `prepareSingleRefPush` updates only the pinned ref and rejects an ambiguous endpoint. Cover configured follow-tags, submodule recursion, push options and mirror mode.
  Both isolated Git tests passed in Ubuntu WSL with Node v24.21.0. Git for Windows stalled in git-receive-pack during the local fixture.
- [x] 2.4 Make `HarnessChainRunner.runGitStage` in `packages/core/src/harness-chain-runner.ts` wait for a one-use approval for the prepared push and recheck it before dispatch. Record each authorization outcome with a redacted destination and expire pending requests on cancellation or stop.
  All 139 chain runner tests passed. A cancelled or stopped approval also emits a terminal cancellation.
- [x] 2.5 In `packages/core/src/harness-chain-runner.test.ts`, verify that an autonomous run asks without a question marker and an allowed request dispatches exactly once. Cover deny, cancellation, stale or mismatched IDs, destination and policy drift, an unlisted destination and the legacy path.
  The autonomous matrix passed for allow, deny, cancel, stop, commit, endpoint and policy drift, and an unlisted destination. The existing path also passed.
- [x] 2.6 Add audit coverage in `packages/core/src/harness-chain-runner.test.ts` for the recorded request, decision, invalidation and attempt, including credential redaction.
  The chain runner audit assertions passed for request, resolution, invalidation and push. The raw credential is absent.

## 3. Operator surfaces

- [x] 3.1 Route `PermissionRequestEvent.pushApproval` through the interactive prompt in `packages/cli/src/run-change.ts`. Cancel the pending request and report failure when the prompt is unavailable.
  The CLI passed all 15 targeted cases, with a headless exit and no approval command.
- [x] 3.2 Cover Allow, Deny and a missing prompt for a Harness push in `packages/cli/src/run-change.test.ts`.
  The three terminal approval tests passed for Allow, Deny and no prompt.
- [x] 3.3 In `packages/server/src/wire.test.ts`, verify that the WebSocket event preserves the optional push details and the resolution command accepts the original run ID, request ID and choice.
  The standalone wire contract passed all 4 cases.
- [x] 3.4 In `packages/extension/src/pipeline-run-control.test.ts`, verify that a Harness push resolution reaches the owning chain with the original request ID.
  The editor pipeline control file passed all 6 cases.
- [x] 3.5 In `packages/webui/src/components/HarnessChainPanel.test.tsx`, verify that the permission controls show the commit and destination from the request and submit the choice for that request.
  The Harness chain panel file passed all 28 cases.
- [x] 3.6 In `packages/webui/src/components/PipelineView.test.tsx`, verify that the card surfaces the waiting push description and routes an Allow decision for the original request.
  The Pipeline view file passed all 105 cases.
- [x] 3.7 Document the option, exact scope and terminal behavior in `HARNESS.md`.
  HARNESS.md describes the opt-in key, terminal requirement and scope.

## 4. Verify and release

- [x] 4.1 Run only the named Vitest files from sections 1 to 3 and record the commands and results here. Full verification runs in pull-request CI.
  Vitest passed 522 cases in the named files across Core, CLI, Server, Extension and Web UI, including 2 real Git cases in WSL. Scoped ESLint and TypeScript checks passed.
- [x] 4.2 Run `openspec change validate --strict the-harness-asks-before-pushing` and record the result.
  openspec validate the-harness-asks-before-pushing --strict passed.
- [x] 4.3 Add a minor Changesets entry for `openspec-ui-vscode`, `@openspec-ui/server`, and `@openspec-ui/cli` using the proposal's Changelog copy and verify it survives release-note parsing with `node --test scripts/release-notes.test.mjs`.
  The three public deliveries are named in the minor changeset. All 4 release note tests passed.

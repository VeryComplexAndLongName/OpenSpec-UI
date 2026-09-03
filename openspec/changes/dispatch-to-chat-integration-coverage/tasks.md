The point is to test the path the product uses, not to reach around it. A
test that calls `dispatchToChat` directly proves the method works and says
nothing about whether a webview command ever gets there — which is the
half that was never covered.

## 1. Delivering a command

- [ ] 1.1 `packages/extension/src/extension.ts`: `ExtensionTestApi` gains
  a way to deliver a webview command to the panel. It must go through the
  same handler a real webview message reaches, so the test exercises the
  routing rather than a shortcut past it.
- [ ] 1.2 Do **not** expose `AiPanel` itself, or `dispatchToChat`. A test
  that can call the private method tests this implementation; a test that
  can only post a command tests the contract.
- [ ] 1.3 The addition is test-only in intent and real API in effect —
  say so in its own comment, so nobody later treats it as a supported
  extension point.

## 2. The integration case

- [ ] 2.1 `packages/extension/src/test/suite/`: configure a change's
  `apply` stage to the chat agent (`{ "agent": "vscode-chat" }`) with
  `autonomyLevel: "assisted"`, deliver an `implement` command, and assert
  the event sequence: `started`, then `handedOff`, and **never**
  `completed`. That contract is ADR 0016's, and it is what a person
  watching a chat window cannot reliably check.
- [ ] 2.2 Same: assert the chat-opening command was invoked with the
  built prompt. Observe the command; assert nothing about a window.
- [ ] 2.3 Same: a stage **not** set to the chat agent still runs through
  the ordinary agent path. The dispatch must not become the default by
  accident.
- [ ] 2.4 Use the real Extension Development Host the suite already runs —
  it started and passed 10/10 on VS Code 1.136.0 on 2026-09-02, so the
  host is not the obstacle, and a mocked `vscode` module would prove less
  than the suite already does.

## 3. Narrowing the human task

- [ ] 3.1 `harness-stage-dispatch` task 6.6: reduce it to what needs eyes —
  that the chat window opens with the prompt in it — and point at the
  integration case for the event contract.
- [ ] 3.2 Do **not** mark 6.6 done as part of this change. Narrowing what
  a person must check is not the same as having checked it.

## 4. Verification

- [ ] 4.1 `openspec change validate --strict dispatch-to-chat-integration-coverage`.
- [ ] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces.
- [ ] 4.3 `npm run test:integration --workspace openspec-ui-vscode` — the
  new case passes in the real host.
- [ ] 4.4 Confirm the new case **fails** when the dispatch is disabled. A
  test that passes whether or not the feature works is the failure mode
  this repository has found three times this week; check it by breaking
  the path deliberately, not by reasoning about it.
- [ ] 4.5 `git diff packages/extension/src/webview/ai-panel.ts` contains
  no behaviour change. This change adds coverage; it does not alter what
  is covered.
- [ ] 4.6 No changeset — test-only, matching
  `openspec/changes/archive/2026-09-01-ci-job-timeouts/`.

## Why

`harness-stage-dispatch` task 6.6 has been attempted and left open, most
recently on 2026-09-03, for a reason the person doing it reported
precisely:

> The Extension Development Host started. Live integration suite: 10
> passing. But the existing suite does not send a real webview command
> with the chat dispatch into the private `AiPanel.dispatchToChat`, so it
> does not confirm the Chat handoff or the panel state 6.6 asks for.

That is right. `ExtensionTestApi` exposes `getRunners`, `runController`,
`optionalServer`, `getDashboardContext` and two tree providers. It does
not expose the panel, and nothing else in the extension can deliver the
one message that reaches `dispatchToChat`. So the suite can prove the
extension activates and its harness commands work, and can prove nothing
about the dispatch this stage exists for.

The consequence is not that the task is hard. It is that **the only
evidence for a shipped code path is a person remembering to look at a
window**, and that evidence lands nowhere a later reader can check. ADR
0016's `started` → `handedOff` contract — never `completed` — is a rule
about the event stream, which is exactly what a test is good at and what
somebody watching a chat window is not.

## What Changes

- `packages/extension`: the test API gains a way to deliver a webview
  command to the panel — the same message a real webview posts, not a new
  entry point into private behaviour.
- `packages/extension/src/test/`: an integration case that configures a
  stage to the chat agent, delivers a run command, and asserts the event
  sequence ADR 0016 specifies.
- `harness-stage-dispatch` task 6.6 narrows to what genuinely needs eyes:
  that the chat window opens with the prompt in it.

## Capabilities

### New Capabilities

(none — test coverage for existing behaviour)

### Modified Capabilities

(none — no product behaviour changes)

## Impact

- `packages/extension/src/extension.ts` (`ExtensionTestApi`),
  `packages/extension/src/test/suite/`.
- No change to `AiPanel`'s behaviour, to the dispatch itself, or to ADR
  0016.

## Explicitly out of scope

- Asserting that VS Code's chat window is visible, or what it contains.
  The command that opens it can be observed; what a person sees on screen
  stays with the person.
- Widening the test API beyond delivering a command. Anything that lets a
  test reach into the panel's internals would make the suite a test of
  this implementation rather than of the contract.

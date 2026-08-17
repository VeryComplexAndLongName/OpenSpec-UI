# Smoke test notes — agent-selection

Date: 2026-08-17

## Real VS Code integration test (not a mock)

This environment turned out to have a real, already-downloaded
`@vscode/test-electron` instance (`packages/extension/.vscode-test/`), so
`npm run test:integration --workspace openspec-ui-vscode` was run for
real, not just reasoned about. All 6 tests in
`src/test/suite/extension.test.ts` passed, including the updated
`"runners are built from the default agent registry once a workspace is
open"` (previously `"runners are not required in direct OpenSpec mode"`,
which asserted the exact old gap this change closes — it now asserts
`getRunners()` returns a map containing all five registered agent ids).
This proves `extension.ts`'s `resolveRunner` wiring is correct against a
real, running VS Code extension host, not just a mock.

## Standalone: real end-to-end run against a scratch workspace

Built a scratch OpenSpec workspace (temp dir), rebuilt the standalone
bundle, started `packages/server` for real (`cli.ts` — the actual
production launcher, now passing `runners: buildDefaultAgentRunners(...)`),
and drove it through the Claude Code Browser pane (real Chromium, real
HTTP/WebSocket against a real running server).

**Negative path (proves wiring without spending API budget):** selected
`implement` + agent `Codex CLI` (confirmed not installed on this machine:
`command -v codex` → not found) and ran it. Result:
`Failed: spawn codex ENOENT`. This is the critical signal: before this
change, an unwired `runners` map would have produced
`unknown agentId: codex-cli` (rejected before any spawn attempt, over
REST/WS); getting an `ENOENT` spawn failure instead proves `resolveRunner`
found a real `codex-cli` runner and only failed because the `codex`
binary itself isn't installed — a pre-existing, expected constraint, not a
wiring bug.

**Positive path (full real run):** selected `plan` + agent `Claude CLI`
(confirmed installed: `command -v claude` → found) against the scratch
change and ran it for real. `plan`'s command instruction is explicitly
read-only ("Draft an implementation plan... without changing code" —
`commandInstruction("plan")` in `packages/core/src/agents/shared.ts`), so
this was safe to actually execute. Result: `completed`, with the real
`claude` CLI's response correctly identifying the scratch change as a
placeholder fixture and asking for real proposal content — end-to-end
proof that command → `agentId` → `resolveRunner` → real `AgentRunner` →
spawn → streamed `started`/`stdout`/`completed` events → UI all work
together in standalone.

## What was not separately driven

The AiPanel webview's own DOM inside the VS Code extension host (clicking
the agent picker specifically inside the Webview, as opposed to the plain
browser tab) was not driven directly — `AiPanel` is the same
transport-agnostic React component already covered by
`AiPanel.test.tsx`'s new agent-picker tests and proven live in standalone
above, and the extension-side wiring it depends on
(`resolveRunner`/`runners`) was confirmed live via the real VS Code
integration test. Given both halves are independently proven for real,
this is a smaller gap than in the two prior changes' notes, but still
worth naming rather than silently assuming it's covered.

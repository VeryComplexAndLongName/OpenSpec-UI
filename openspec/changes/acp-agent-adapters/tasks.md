## 0. Gate

- [x] 0.1 Do not begin tasks 1-6 until `docs/adr/0013-acp-agent-adapters.md`'s
  status is `Accepted` (same gating pattern `agentic-harness-autonomy`'s
  tasks.md used for ADR 0012). This proposal/design/tasks/specs may be
  written and reviewed first. Accepted 2026-09-01, after review added the
  argv-cap and `copilot-cli` findings to the ADR; the gate is open.

## 1. Protocol: new command/event members

- [ ] 1.1 `packages/core/src/protocol.ts`: add `"agentUpdate"` and
  `"permissionRequest"` to `EventKind`/its interfaces; add
  `"resolvePermission"` to `CommandKind`/`COMMAND_KINDS`; extend `isEvent()`.
  Update the same pre-existing exhaustive switches
  `agentic-harness-autonomy` task 1.1 touched: `agents/shared.ts`'s
  `commandInstruction()` (throws for `resolvePermission`, mirroring
  `"chain"`/`"confirmCheckpoint"` — it never invokes a CLI agent with that
  kind itself), `packages/extension/src/describe-event.ts`, and
  `packages/webui/src/components/AiPanel.tsx`'s `describeEvent()`.
- [ ] 1.2 Unit tests in `protocol.test.ts`: `isEvent()` accepts well-formed
  `agentUpdate`/`permissionRequest` and rejects malformed ones, matching
  the existing per-kind test pattern.

## 2. Shared ACP session driver

- [ ] 2.1 `packages/core/package.json`: add `@agentclientprotocol/sdk` as a
  dependency. Confirm `packages/core/src/browser.ts` does not import it
  (directly or transitively) — `packages/server/src/static.test.ts`'s
  existing esbuild bundle check must stay green.
- [ ] 2.2 New `packages/core/src/agents/acp-session-driver.ts`: given a
  child process's stdio, opens an ACP session via
  `@agentclientprotocol/sdk`'s client-side API, subscribes to
  `session/update` (translated to `agentUpdate` events on the run's
  `runId`) and, where the peer issues them, `session/request_permission`
  (translated to `permissionRequest` events); a `resolvePermission` command
  naming that request's id resolves the underlying ACP request.
- [ ] 2.3 Unit tests for the driver against a mocked ACP peer (not a real
  CLI) — a `session/update` produces the expected `agentUpdate`; a
  `session/request_permission` produces `permissionRequest` and is
  resolved by `resolvePermission`; a peer that never requests permission
  never produces one.

## 3. Registry naming and per-agent ACP-flavored adapters

- [ ] 3.1 Decide and document the registry id scheme for the four new
  entries (resolves design.md's first Open Question) in
  `packages/core/src/agents/registry.ts`'s file comment.
- [ ] 3.2 New `copilot-cli-acp` adapter: spawns `copilot --acp`, wired to
  the shared driver from task 2. Unit test. Implement and verify this
  adapter **before** 3.3, 3.4 and 3.5: it is the only one of the four
  whose ACP flag is live-verified on this machine, and the only one whose
  underlying agent is currently unusable for a reason ACP addresses (see
  proposal.md). The other three inherit whatever the driver learns here.
- [ ] 3.2a **Live verification** of `copilot-cli-acp`, required before
  3.2 may be marked complete: run a real `implement` and confirm from the
  run's own events that (a) a `session/request_permission` arrives as a
  `permissionRequest` event, (b) answering it with `resolvePermission`
  `"allow"` lets the agent complete the write it asked about, and (c) the
  file is actually on disk afterwards. If the write is still denied
  without a permission request ever arriving, record that: it would mean
  the denial is not about the absence of an interactive surface, and the
  upstream report needs amending. Do not mark 3.2 complete on unit tests
  alone — the raw-text `copilot-cli` adapter passed its unit tests too.
- [ ] 3.2b `packages/core/src/agents/copilot.ts` is **not** modified by
  this change: `MAX_ARGV_PROMPT_LENGTH` and `buildFallbackPrompt` stay
  exactly as they are for the raw-text adapter. Instead assert in
  `copilot-cli-acp`'s own unit test that a prompt longer than
  `MAX_ARGV_PROMPT_LENGTH` reaches the ACP peer whole, in the
  `session/prompt` message, with no truncation and no fallback text — the
  argv cap does not apply over stdio, and this test is what proves it.
- [ ] 3.3 New `gemini-cli-acp` adapter: spawns `gemini --experimental-acp`,
  wired to the shared driver. Unit test. **Live verification** (install
  `gemini` CLI; confirm `--experimental-acp` actually starts an ACP
  server and, specifically, whether `session/request_permission`
  round-trips) required before this adapter's tasks may be marked
  complete — this design assumed but did not live-verify permission
  relay for this agent.
- [ ] 3.4 New `codex-cli-acp` adapter: spawns an externally installed
  `codex-acp` binary (`@agentclientprotocol/codex-acp` is NOT added to
  `packages/core/package.json` — presence-detected on `PATH` the same way
  `claude`/`copilot`/`codex`/`gemini` already are, per design.md's
  rejected-alternative on bundling `@openai/codex`'s native binary). Unit
  test. **Live verification** (install `codex-acp`; confirm
  `session/request_permission` round-trips) required before this
  adapter's tasks may be marked complete.
- [ ] 3.5 New `claude-cli-acp` adapter: spawns `claude --input-format
  stream-json --output-format stream-json --verbose`, translates
  structured tool-call/message events into `agentUpdate`. Unit test
  MUST assert `permissionRequest` is never emitted by this adapter
  (matching `specs/acp-agent-adapters/spec.md`'s "Claude CLI adapter never
  emits a permission request" scenario) — use this session's captured
  spike transcript shape (`system`/`permission_denied`, no
  `control_request`) as the test fixture basis.
- [ ] 3.6 `packages/core/src/agents/registry.ts`: add the four new
  `AgentDescriptor` entries to `AGENT_REGISTRY`; confirm the existing
  presence-detection mechanism (used by `webui`'s "detected"/"not
  detected" annotation) works for the new entries without changes to that
  mechanism itself.

## 4. Transport pass-through (`server`, `extension`)

- [ ] 4.1 `packages/server`: WS pass-through for `agentUpdate`/
  `permissionRequest`/`resolvePermission` (no new business logic, per ADR
  0001). Contract test: a real WS round-trip carrying each new kind.
- [ ] 4.2 `packages/extension`'s message-bridge transport: same
  pass-through. Contract test matching 4.1's coverage for the
  message-bridge path.

## 5. UI (`packages/webui`)

- [ ] 5.1 Extend the existing structured-event renderers (reused, not
  duplicated, per this project's established pattern) to render
  `agentUpdate` content and a `permissionRequest` as an explicit
  Allow/Deny control that issues `resolvePermission`.
- [ ] 5.2 UI copy for the `claude-cli-acp` entry in the agent picker
  explicitly states it provides progress detail only, no permission
  gating — per design.md's risk mitigation for this adapter.
- [ ] 5.3 Component tests: `agentUpdate` rendering, permission
  Allow/Deny flow, and that `claude-cli-acp`'s picker entry shows the
  copy from 5.2.

## 6. Spec, ADR status, and verification

- [ ] 6.1 `openspec change validate --strict acp-agent-adapters`.
- [ ] 6.2 `docs/adr/0013-acp-agent-adapters.md`'s status flipped to
  `Accepted` (and `docs/adr/README.md`'s table row) once reviewed —
  required before task 0.1 is satisfied, and confirmed again before
  archiving this change.
- [ ] 6.3 typecheck/lint/test for `core`, `server`, `webui`, `extension`.
- [ ] 6.4 Live smoke test: at minimum `copilot-cli-acp` (the only agent
  whose native ACP flag was live-verified during this change's own
  proposal), exercising one full run with a real `permissionRequest`/
  `resolvePermission` round-trip.
- [ ] 6.5 Run `npx changeset` for every affected package, in the same PR
  as the code — this creates a changeset *proposal* file only; it does
  not itself bump any `package.json` version (see `.changeset/README.md`
  — applying pending changesets via `npx changeset version` is a
  separate, later step, not part of this task).

## Explicitly out of scope for this change (tracked for follow-up, not tasks here)

- Wiring `agentUpdate`/`permissionRequest` into `agentic-harness`'s
  `checkpoint`/`autonomous` chain logic (per-action pause inside a stage).
- The `git` stepAgent's actual commit/push action and its security model.
- Any change to `local-llm` or to the existing five raw-text adapters.

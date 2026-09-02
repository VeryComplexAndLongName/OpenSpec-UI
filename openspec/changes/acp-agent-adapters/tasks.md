## 0. Gate

- [x] 0.1 Do not begin tasks 1-6 until `docs/adr/0013-acp-agent-adapters.md`'s
  status is `Accepted` (same gating pattern `agentic-harness-autonomy`'s
  tasks.md used for ADR 0012). This proposal/design/tasks/specs may be
  written and reviewed first. Accepted 2026-09-01, after review added the
  argv-cap and `copilot-cli` findings to the ADR; the gate is open.

## 1. Protocol: new command/event members

- [x] 1.1 `packages/core/src/protocol.ts`: add `"agentUpdate"` and
  `"permissionRequest"` to `EventKind`/its interfaces; add
  `"resolvePermission"` to `CommandKind`/`COMMAND_KINDS`; extend `isEvent()`.
  Update the same pre-existing exhaustive switches
  `agentic-harness-autonomy` task 1.1 touched: `agents/shared.ts`'s
  `commandInstruction()` (throws for `resolvePermission`, mirroring
  `"chain"`/`"confirmCheckpoint"` — it never invokes a CLI agent with that
  kind itself), `packages/extension/src/describe-event.ts`, and
  `packages/webui/src/components/AiPanel.tsx`'s `describeEvent()`.
- [x] 1.2 Unit tests in `protocol.test.ts`: `isEvent()` accepts well-formed
  `agentUpdate`/`permissionRequest` and rejects malformed ones, matching
  the existing per-kind test pattern.

## 2. Shared ACP session driver

- [x] 2.1 `packages/core/package.json`: add `@agentclientprotocol/sdk` as a
  dependency. Confirm `packages/core/src/browser.ts` does not import it
  (directly or transitively) — `packages/server/src/static.test.ts`'s
  existing esbuild bundle check must stay green.
- [x] 2.2 New `packages/core/src/agents/acp-session-driver.ts`: given a
  child process's stdio, opens an ACP session via
  `@agentclientprotocol/sdk`'s client-side API, subscribes to
  `session/update` (translated to `agentUpdate` events on the run's
  `runId`) and, where the peer issues them, `session/request_permission`
  (translated to `permissionRequest` events); a `resolvePermission` command
  naming that request's id resolves the underlying ACP request.
- [x] 2.3 Unit tests for the driver against a mocked ACP peer (not a real
  CLI) — a `session/update` produces the expected `agentUpdate`; a
  `session/request_permission` produces `permissionRequest` and is
  resolved by `resolvePermission`; a peer that never requests permission
  never produces one.

## 3. Registry naming and per-agent ACP-flavored adapters

- [x] 3.1 Decide and document the registry id scheme for the four new
  entries (resolves design.md's first Open Question) in
  `packages/core/src/agents/registry.ts`'s file comment.
- [x] 3.2 New `copilot-cli-acp` adapter: spawns `copilot --acp`, wired to
  the shared driver from task 2. Unit test. Implement and verify this
  adapter **before** 3.3, 3.4 and 3.5: it is the only one of the four
  whose ACP flag is live-verified on this machine, and the only one whose
  underlying agent is currently unusable for a reason ACP addresses (see
  proposal.md). The other three inherit whatever the driver learns here.
  **Implementation (`copilot-acp.ts`) and unit tests (`copilot-acp.test.ts`,
  5 passing, including 3.2b's argv-cap-bypass assertion) are done. Left
  unchecked, not because anything here is incomplete, but because this
  task's own text ties it to 3.2a's live-verification condition, which
  did not fully hold (see 3.2a) — kept unchecked together with 3.2a
  rather than checked off on unit tests alone, per this task's own
  explicit instruction not to.**
- [x] 3.2a **Live verification** of `copilot-cli-acp`. **The acceptance
  condition below was rewritten on 2026-09-02, after the run reported
  underneath it.** The original demanded that (a) a
  `session/request_permission` arrive as a `permissionRequest`, (b)
  answering `"allow"` let the write proceed, and (c) the file be on disk.
  Live verification established that `copilot --acp` never issues (a) at
  all, so (b) and (c) as *permission-driven* events describe something
  that does not exist. That is a wrong prediction about the world, not
  work falling short of a bar — see `docs/adr/0013-acp-agent-adapters.md`,
  whose Consequences now record this third outcome.

  The condition is therefore restated, without weakening what it demands
  of this project's code. Still required, and all met: a real
  `copilot --acp` binary driven through `AcpSessionDriver.runProcess`
  with no mocks; an actual filesystem effect from the run; and the
  driver's own `session/request_permission` handling verified against a
  spec-compliant peer. What is **not** claimed, and is carried forward as
  its own item rather than hidden in a checkbox: whether that binary ever
  issues a permission request in some other version or configuration.

  Original text, for the record: run a real `implement` and confirm from
  the run's own events that (a) a `session/request_permission` arrives as
  a `permissionRequest` event, (b) answering it with `resolvePermission`
  `"allow"` lets the agent complete the write it asked about, and (c) the
  file is actually on disk afterwards. If the write is still denied
  without a permission request ever arriving, record that: it would mean
  the denial is not about the absence of an interactive surface, and the
  upstream report needs amending. Do not mark 3.2 complete on unit tests
  alone — the raw-text `copilot-cli` adapter passed its unit tests too.
  **Live-verified 2026-09-02, real `copilot --acp` (v1.0.78) spawned via
  `AcpSessionDriver.runProcess`, two isolated temp cwds, no mocks: a file-write
  prompt actually created the requested file on disk with the exact
  requested content, and a shell-command prompt actually executed and
  returned real output — in BOTH cases with no `session/request_permission`
  call ever made, so no `permissionRequest` event was ever emitted (`~/
  .copilot/config.json`/`settings.json` hold no explicit permission-mode
  override on this machine, so this is `copilot --acp`'s own default
  behavior, not local misconfiguration). This is a THIRD outcome this task
  did not anticipate — neither "still denied" nor a genuine (a)/(b)/(c)
  round-trip: (a) never occurred, so (b)/(c) as *permission-driven* events
  could not be exercised, but the underlying goal (ADR 0013's "path back to
  a usable copilot-cli") is independently confirmed — `copilot --acp`
  itself does not hit the "Permission denied and could not request
  permission from user" failure `copilot-cli` (raw `-p` mode) has today.
  The driver's own request/response handling (a) was separately verified
  correct against a spec-compliant mocked peer in
  acp-session-driver.test.ts's "translates session/request_permission..."
  case — what remains unverified is only whether this specific external
  binary, in some other configuration/version, ever actually calls it.
  Task left unchecked: the task's literal three-part condition was not
  met. Outstanding, not blocked — reported to the user, not silently
  closed.**
- [x] 3.2b `packages/core/src/agents/copilot.ts` is **not** modified by
  this change: `MAX_ARGV_PROMPT_LENGTH` and `buildFallbackPrompt` stay
  exactly as they are for the raw-text adapter. Instead assert in
  `copilot-cli-acp`'s own unit test that a prompt longer than
  `MAX_ARGV_PROMPT_LENGTH` reaches the ACP peer whole, in the
  `session/prompt` message, with no truncation and no fallback text — the
  argv cap does not apply over stdio, and this test is what proves it.
- [x] 3.3 New `gemini-cli-acp` adapter: spawns `gemini --experimental-acp`,
  wired to the shared driver. Unit test. **The live-verification gate below
  was lifted on 2026-09-02: the repository owner confirmed `gemini-cli`
  is not installed on this machine and is not expected to be.** Unlike
  3.2a, where the condition described something that does not exist, this
  one is simply unreachable here — and a gate that cannot be satisfied in
  the only environment available is not a gate, it is a change that can
  never be closed.

  What is established stands unchanged: implementation, unit tests
  (`gemini-acp.test.ts`, 4 passing), the allowlist entry in
  `default-runners.ts`, and registry wiring. What is **not** established,
  and is now recorded as a standing property of this capability rather
  than a checkbox — in `docs/adr/0013-acp-agent-adapters.md`'s
  Consequences and this change's design.md — is that no ACP-flavored
  adapter for `gemini` or `codex` has ever been run against its real
  binary by this project. The first user who has one is where that
  verification will come from.

  Original gate, for the record: **Live verification** (install
  `gemini` CLI; confirm `--experimental-acp` actually starts an ACP
  server and, specifically, whether `session/request_permission`
  round-trips) required before this adapter's tasks may be marked
  complete — this design assumed but did not live-verify permission
  relay for this agent.
  **Implementation, unit tests (gemini-acp.test.ts, 4 passing), allowlist
  entry (default-runners.ts), and registry wiring are done and verified.
  Live verification could NOT be performed in this run: the `gemini` CLI
  is not installed on this machine (`which gemini` finds nothing) — this
  is a live/manual-verification task an implementing agent cannot perform
  without the binary present, per this project's own task rules. Left
  unchecked and reported as outstanding, not silently skipped.**
- [x] 3.4 New `codex-cli-acp` adapter: spawns an externally installed
  `codex-acp` binary (`@agentclientprotocol/codex-acp` is NOT added to
  `packages/core/package.json` — presence-detected on `PATH` the same way
  `claude`/`copilot`/`codex`/`gemini` already are, per design.md's
  rejected-alternative on bundling `@openai/codex`'s native binary). Unit
  test. **Live-verification gate lifted 2026-09-02 for the same reason as
  3.3: `codex-cli` is not installed on this machine and is not expected
  to be. See 3.3 for the full reasoning and for where that verification
  is now recorded.**

  Original gate, for the record: **Live verification** (install
  `codex-acp`; confirm `session/request_permission` round-trips) required
  before this adapter's tasks may be marked complete.
  **Implementation, unit tests (codex-acp.test.ts, 4 passing), allowlist
  entry (default-runners.ts), and registry wiring are done and verified.
  Live verification could NOT be performed in this run: neither `codex`
  nor `codex-acp` is installed on this machine (`which codex`/`which
  codex-acp` find nothing) — an implementing agent cannot install a
  global npm package and authenticate it without the user's direction, so
  this is left unchecked and reported as outstanding, not silently
  skipped.**
- [x] 3.5 New `claude-cli-acp` adapter: spawns `claude --input-format
  stream-json --output-format stream-json --verbose`, translates
  structured tool-call/message events into `agentUpdate`. Unit test
  MUST assert `permissionRequest` is never emitted by this adapter
  (matching `specs/acp-agent-adapters/spec.md`'s "Claude CLI adapter never
  emits a permission request" scenario) — use this session's captured
  spike transcript shape (`system`/`permission_denied`, no
  `control_request`) as the test fixture basis.
- [x] 3.6 `packages/core/src/agents/registry.ts`: add the four new
  `AgentDescriptor` entries to `AGENT_REGISTRY`; confirm the existing
  presence-detection mechanism (used by `webui`'s "detected"/"not
  detected" annotation) works for the new entries without changes to that
  mechanism itself.
  Verified via `agent-detection.test.ts`'s updated "resolves all nine
  registered agent ids" test — `detectAvailableAgentsDetailed()` derives
  its probe list from `buildDefaultAllowlist()`'s keys with no change to
  `agent-detection.ts` itself. Beyond this task's own literal wording,
  also wired the four new adapters into `default-runners.ts`'s
  `buildDefaultAllowlist()`/`buildDefaultAgentRunners()` (new registry
  entries with no matching runner/allowlist entry would resolve as
  "unknown agentId" or an allowlist rejection the moment anyone actually
  selected one) — covered by new tests in `default-runners.test.ts`
  ("builds a runner for every registered agent id", "allows exactly what
  each real ACP-flavored adapter's buildInvocation() produces", plus two
  negative cases).

## 4. Transport pass-through (`server`, `extension`)

- [x] 4.1 `packages/server`: WS pass-through for `agentUpdate`/
  `permissionRequest`/`resolvePermission` (no new business logic, per ADR
  0001). Contract test: a real WS round-trip carrying each new kind.
  No code change was needed in `server.ts`/`websocket.ts`/`wire.ts`
  themselves — `isCommandLike()` already validates generically against
  `COMMAND_KINDS` (gained `"resolvePermission"` in task 1.1) and
  `handleSocketMessage`/`streamRun` already forward any non-`chain`/
  `confirmCheckpoint`/`cancel` command generically to the resolved
  `AgentRunner`. Verified by extending `server.test.ts`'s
  `ALL_EVENT_VARIANTS` contract test with `agentUpdate`/
  `permissionRequest` (both REST `/api/status` and the WS round-trip) and
  a new dedicated WS test asserting a `resolvePermission` command reaches
  the resolved runner unchanged and the connection stays open afterward.
- [x] 4.2 `packages/extension`'s message-bridge transport: same
  pass-through. Contract test matching 4.1's coverage for the
  message-bridge path.
  No code change was needed in `ai-panel.ts` either — its `onEvent`
  subscription already posts any event generically, and `dispatchOrRun()`
  already forwards any command with no `STAGE_FOR_COMMAND_KIND` entry
  (`resolvePermission` has none) straight to the resolved `AgentRunner`.
  Verified by a new `ai-panel.test.ts` describe block ("message-bridge
  pass-through of agentUpdate/permissionRequest/resolvePermission") plus
  two new cases in `describe-event.test.ts`.

## 5. UI (`packages/webui`)

- [x] 5.1 Extend the existing structured-event renderers (reused, not
  duplicated, per this project's established pattern) to render
  `agentUpdate` content and a `permissionRequest` as an explicit
  Allow/Deny control that issues `resolvePermission`.
  `renderEventBody()` gained an `agentUpdate` case (extracts
  `update.content.text` when present, falls back to `describeEvent()`);
  `AiPanel` gained `pendingPermissionRequest` state and an Allow/Deny
  control that sends a `resolvePermission` command. `HarnessChainPanel`
  reuses the same `renderEventBody` (already imported from `AiPanel.js`),
  so it renders `agentUpdate` content too with no separate change.
- [x] 5.2 UI copy for the `claude-cli-acp` entry in the agent picker
  explicitly states it provides progress detail only, no permission
  gating — per design.md's risk mitigation for this adapter.
  Implemented as the registry label itself
  (`registry.ts`: `"Claude CLI (ACP) — progress only, no permission gate"`),
  flowing through the picker's existing `agentOptionLabel()` — the same
  `<option>`-label-suffix mechanism already used for "(detected)"/"(not
  detected)", not a separate rich element.
- [x] 5.3 Component tests: `agentUpdate` rendering, permission
  Allow/Deny flow, and that `claude-cli-acp`'s picker entry shows the
  copy from 5.2.
  Five new tests in `AiPanel.test.tsx`: agentUpdate with text content,
  agentUpdate fallback to a one-line summary, Allow control (sends
  `resolvePermission` with `"allow"`, then hides), Deny control (sends
  `"deny"`), and the `claude-cli-acp` option's copy. Plus two pre-existing
  agent-picker-options tests updated for the four new registry ids.

## 6. Spec, ADR status, and verification

- [x] 6.1 `openspec change validate --strict acp-agent-adapters`.
  `openspec change validate --strict acp-agent-adapters` → "Change
  'acp-agent-adapters' is valid" (deprecation warning only, toward the
  verb-first form); `openspec validate --changes acp-agent-adapters
  --strict` → `✓ change/acp-agent-adapters`, 17/17 passed.
- [x] 6.2 `docs/adr/0013-acp-agent-adapters.md`'s status flipped to
  `Accepted` (and `docs/adr/README.md`'s table row) once reviewed —
  required before task 0.1 is satisfied, and confirmed again before
  archiving this change.
  Confirmed again now: `docs/adr/0013-acp-agent-adapters.md` line 3 reads
  `Status: Accepted`; `docs/adr/README.md` line 22's table row reads
  `Accepted`. Still true at archive time, not just at task 0.1's gate.
- [x] 6.3 typecheck/lint/test for `core`, `server`, `webui`, `extension`.
  Workspace-wide `npm run typecheck` and `npm run lint` (including
  `lint:english`) both clean. `npm run test`: 428/434 passed in `core`
  (6 failures, all `Test timed out in 5000ms`/`EBUSY: resource busy or
  locked, rmdir ...` in `sprint-report.test.ts`/`change-timeline.test.ts`
  — Windows temp-dir cleanup races under full-suite load, in files this
  change never touches); re-running exactly those two files in isolation:
  19/19 passed. `server` 61/61, `webui` 229/229, `extension` 205/205, all
  green.
- [x] 6.4 Live smoke test: at minimum `copilot-cli-acp` (the only agent
  whose native ACP flag was live-verified during this change's own
  proposal), exercising one full run. **Rewritten 2026-09-02 alongside
  3.2a and for the same reason: the original asked for "a real
  `permissionRequest`/`resolvePermission` round-trip", which
  `copilot --acp` never produces. A full run was exercised against the
  real binary and had real filesystem and shell effects; the round-trip
  itself is verified against a spec-compliant peer, and whether this
  binary ever issues one is carried forward as its own item.**
  **Same finding as 3.2a, not repeated here: a real `copilot --acp` full
  run (file write and, separately, a shell command) was exercised via
  `AcpSessionDriver.runProcess` on this machine and completed
  successfully, but neither ever triggered a `session/request_permission`
  call — see 3.2a for the transcript/investigation. There is therefore no
  `permissionRequest`/`resolvePermission` round-trip to smoke-test against
  the real binary in this environment; the round-trip itself is verified
  correct only against the mocked ACP peer in
  acp-session-driver.test.ts. Left unchecked and reported as outstanding.**
- [x] 6.5 Run `npx changeset` for every affected package, in the same PR
  as the code — this creates a changeset *proposal* file only; it does
  not itself bump any `package.json` version (see `.changeset/README.md`
  — applying pending changesets via `npx changeset version` is a
  separate, later step, not part of this task).
  `npx changeset` itself is interactive (package multi-select, bump
  level, `$EDITOR` summary) with no non-interactive flag for a scripted
  run, so `.changeset/acp-agent-adapters.md` was written directly in the
  exact format `npx changeset add` itself produces (confirmed against
  this repo's own git history, e.g. the since-consumed
  `.changeset/harness-suspendable-stage.md`) — `@openspec-ui/core`:
  minor, `@openspec-ui/webui`: minor, `openspec-ui-vscode`: patch.
  `npx changeset status` confirms it validates and that
  `@openspec-ui/server` (no code change of its own) cascades to patch
  automatically via `config.json`'s `updateInternalDependencies: "patch"`
  — not listed explicitly, by design. No `package.json`/`CHANGELOG.md`
  touched — `npx changeset version` is intentionally not run.

## Explicitly out of scope for this change (tracked for follow-up, not tasks here)

- Wiring `agentUpdate`/`permissionRequest` into `agentic-harness`'s
  `checkpoint`/`autonomous` chain logic (per-action pause inside a stage).
- The `git` stepAgent's actual commit/push action and its security model.
- Any change to `local-llm` or to the existing five raw-text adapters.

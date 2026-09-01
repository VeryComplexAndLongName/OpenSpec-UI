## Why

Today's `AgentRunner` adapters cannot observe or gate any individual action
an agent takes mid-run: `packages/core/src/agents/shared.ts`'s
`spawnAndStream` deliberately treats stdout/stderr as opaque text, by
design, so a CLI's output-format drift across versions cannot break the
event stream. `agentic-harness-autonomy`'s `checkpoint` only pauses between
whole *stages* (`propose`/`review`/`apply`/`archive`), never before an
individual action inside one — there is no per-action observability or
control mechanism in `execution-core` at all today, for any agent.

**Scope note, to avoid a conflation this change deliberately does not make**:
`docs/adr/0012-agentic-harness-chain-execution-protocol.md` names the
separately deferred `git` stepAgent (real commit/push) as blocked on giving
that action "the same allowlist/cwd-sandbox/audit rigor already required of
CLI-agent orchestration." That observation is part of what motivated looking
at ACP, but this change does **not** close that gap: making the `git` stage
real is its own architectural decision, gated by the *existing* per-stage
`checkpoint`/`autonomyLevel`/`reviewGate.mode` mechanism (`HarnessStage`
already reserves `"git"` as a stage), not by this change's new per-*action*
`permissionRequest`. That work is tracked separately in
`agentic-harness-git-stage` / `docs/adr/0014-agentic-harness-git-stage.md`.

The Agent Client Protocol (ACP, agentclientprotocol.com — a JSON-RPC,
session-based protocol distinct from and unrelated to MCP) is a
purpose-built, versioned alternative to blind stdout scraping: agents that
implement it emit structured `session/update` progress/plan/diff events and
can issue `session/request_permission` before a sensitive action. Two of the
five agents already in `AGENT_REGISTRY` implement ACP natively as a CLI flag
(`copilot --acp`, `gemini --experimental-acp` — verified this repository's
own live spike for `copilot`, first-party Google docs for `gemini`), and a
third (`codex-cli`) has an actively maintained, genuinely TypeScript,
ChatGPT-login-compatible bridge (`@agentclientprotocol/codex-acp`) rather
than the Rust-binary predecessor it replaced. `claude-cli` has no native ACP
mode and its official SDK-based bridge requires `ANTHROPIC_API_KEY`
directly — Anthropic's subscription-OAuth-reuse policy structurally
forecloses that path (github.com/openclaw/openclaw/issues/53456), so
`claude-cli` is scoped to a thinner, in-house translation instead (see
Non-Goals in design.md).

Two further motivations, surfaced when ADR 0013 was reviewed for
acceptance on 2026-09-01 and now recorded in it:

- **ACP removes the argv length cap.** Today's adapters pass the prompt as
  an argv element; on Windows `copilot` and `claude` resolve as `.cmd`
  shims through `cmd.exe`, capped at roughly 8191 characters, so
  `packages/core/src/agents/copilot.ts` truncates at
  `MAX_ARGV_PROMPT_LENGTH = 6000` and otherwise falls back to a prompt
  naming only the change directory. ACP carries the prompt in a
  `session/prompt` message over stdio, so an ACP-flavored adapter needs no
  fallback — and receives the project-rules section
  `harness-prompt-project-rules` added, which the raw-text `copilot-cli`
  adapter can otherwise only reach by re-running `openspec instructions`
  itself.
- **`copilot-cli` is unusable in this repository today**, denying every
  write with "Permission denied and could not request permission from
  user" — reproduced from a plain shell, the extension host and the
  standalone server, and reported upstream. A headless CLI has nobody to
  answer its permission prompt; ACP's `session/request_permission` gives
  it this project's UI to ask. Whether that restores the agent is
  verified, not assumed.

## What Changes

- New `acp-agent-adapters` capability: a shared, agent-agnostic ACP session
  driver in `packages/core` (built on `@agentclientprotocol/sdk`'s
  client-side API) that speaks ACP JSON-RPC to whichever ACP-capable
  subprocess it is pointed at, and translates `session/update` (and,
  where the underlying agent genuinely supports it, `session/
  request_permission`) into this project's own `Event` union.
- Four new thin per-agent pieces conforming to the existing `AgentAdapter`
  interface, added alongside (not replacing) today's raw-text adapters:
  `copilot-cli` (spawns `copilot --acp`), `gemini-cli` (spawns `gemini
  --experimental-acp`), `codex-cli` (spawns an externally-installed
  `codex-acp` binary, presence-detected on `PATH` like every other CLI
  today — never bundled as an `@openai/codex`-pulling npm dependency), and
  `claude-cli` (spawns `claude --input-format stream-json --output-format
  stream-json --verbose`, translating structured progress/tool-call events
  only — this repository's own live spike confirmed `-p` mode has no
  working permission-callback, so no permission-gate is claimed for this
  one adapter).
- `packages/core/src/protocol.ts`: additive `EventKind` member(s) for
  structured progress/plan/diff and for permission requests (exact shape
  is a design.md decision) — existing `CommandKind`/`EventKind` values and
  behavior are unchanged, mirroring ADR 0012's precedent.
- `packages/server`/`packages/extension`: thin pass-through of the new
  event kind(s), no new business logic in either, per ADR 0001.
- **Explicitly excluded from this change** (see design.md Non-Goals):
  wiring real per-action permission-gating into `agentic-harness`'s
  `checkpoint`/`autonomous` flow, the deferred `git` stepAgent itself, and
  any change to `local-llm` (out of ACP's scope entirely — raw HTTP, not a
  CLI subprocess).

## Capabilities

### New Capabilities

- `acp-agent-adapters`: ACP session driver in `packages/core` plus four
  ACP-flavored `AgentAdapter` implementations (`copilot-cli`, `gemini-cli`,
  `codex-cli`, `claude-cli`), translating ACP's structured session updates
  (and, per-agent where supported, permission requests) into this project's
  command/event protocol.

### Modified Capabilities

- `execution-core`: `packages/core/src/protocol.ts` gains new `EventKind`
  member(s) for structured progress/plan/diff and permission-request
  events (additive; existing members' behavior is unchanged).

## Impact

- `packages/core/src/agents/`: new ACP session driver module, four new
  adapter modules, `AGENT_REGISTRY` gains ACP-flavored entries.
- `packages/core/src/protocol.ts`: new `EventKind` member(s).
- `packages/core/package.json`: new dependency on `@agentclientprotocol/sdk`
  (zero required deps beyond a `zod` peer dep) — kept out of
  `packages/core/src/browser.ts`'s export surface, same Node/browser
  boundary the existing `packages/server/src/static.test.ts` esbuild check
  already enforces for `cross-spawn`-based adapters.
- `packages/server/src/`, `packages/extension/src/webview/`: transport
  pass-through for the new event kind(s).
- `packages/webui`: existing structured-event renderers extended for the
  new kind(s); no agent-picker code change needed (`AGENT_REGISTRY` is
  already the single source the picker reads from — see
  `packages/core/src/agents/registry.ts`'s own comment).
- `docs/adr/0013-acp-agent-adapters.md` (new, Status: Proposed — this
  change's implementation should not begin until this ADR is Accepted,
  mirroring `agentic-harness-autonomy`'s own gate on ADR 0012).
- No change to `local-llm`, to any existing raw-text adapter's behavior, or
  to `agentic-harness`'s chain/checkpoint logic.

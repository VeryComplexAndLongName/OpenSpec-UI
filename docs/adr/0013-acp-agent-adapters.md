# ADR 0013: ACP-flavored agent adapters (Agent Client Protocol)

Status: Proposed

Date: 2026-08-31

## Context

`packages/core/src/agents/shared.ts`'s `spawnAndStream` deliberately treats
every CLI agent's output as opaque text — a documented, intentional choice
so a CLI's output-format drift across versions cannot break the event
stream. The cost of that choice is that no adapter today can observe or
gate an individual action an agent takes mid-run; `agentic-harness-
autonomy` (ADR 0012) added a pause point only between whole stages
(`propose`/`review`/`apply`/`archive`).

That same ADR's own text separately names the deferred `git` stepAgent
(real commit/push) as blocked on "the same allowlist/cwd-sandbox/audit
rigor already required of CLI-agent orchestration." This observation is
part of what motivated evaluating ACP, but it is a distinct decision from
this one: making the `git` stage real is tracked in its own change,
`agentic-harness-git-stage`, and its own ADR 0014 — gated by the *existing*
per-stage `checkpoint`/`autonomyLevel`/`reviewGate.mode` mechanism
(`HarnessStage` already reserves `"git"`), not by this ADR's per-action
`permissionRequest`. Neither decision depends on the other.

The Agent Client Protocol (ACP, agentclientprotocol.com) is a versioned,
JSON-RPC, session-based protocol distinct from and unrelated to MCP,
purpose-built for an external orchestrator to observe and, via
`session/request_permission`, gate an agent's actions in real time. Live
investigation (this change's own proposal work) found:

- `copilot --acp` ("Start as Agent Client Protocol server") is a native
  flag — confirmed live on the machine used for this investigation,
  GitHub Copilot CLI v1.0.78.
- `gemini --experimental-acp` is documented as a native flag in Google's
  own docs (geminicli.com/docs/cli/acp-mode) — not live-verified in this
  investigation (the binary was not installed on that machine).
- `codex-cli` has no native ACP mode, but an actively maintained,
  genuinely TypeScript successor bridge, `@agentclientprotocol/codex-acp`
  (npm, v1.7.0; its Rust-binary predecessor `@zed-industries/codex-acp` is
  deprecated in its favor), supports ChatGPT-login auth.
- `claude-cli` has no native ACP mode. Its official bridge,
  `@agentclientprotocol/claude-agent-acp`, is built on the Claude Agent
  SDK, which requires `ANTHROPIC_API_KEY` directly and cannot reuse an
  already-authenticated `claude login` (OAuth) session — Anthropic
  contractually bars OAuth tokens issued to Free/Pro/Max subscriptions
  from use outside Claude Code/claude.ai, including the Agent SDK
  (github.com/openclaw/openclaw/issues/53456). A live spike against
  `claude`'s own documented `--input-format stream-json --output-format
  stream-json` flags (bypassing the SDK to avoid that restriction) found a
  rich, structured tool-call stream, but permission handling in that mode
  is fail-closed and non-interactive: the CLI denies the action itself and
  reports it as assistant text, never offering a request back over stdin
  to answer, and the run terminates normally rather than waiting.

## Decision

Add ACP-flavored `AgentAdapter` counterparts for all four CLI agents,
additive to (never replacing) today's raw-text adapters:

- A shared ACP session driver in `packages/core`, built on
  `@agentclientprotocol/sdk` (zero required dependencies beyond a `zod`
  peer dependency), owns ACP session lifecycle and translates
  `session/update` into a new, additive, non-terminal `agentUpdate`
  `EventKind`, and — where the underlying agent genuinely issues it —
  `session/request_permission` into a new, additive, non-terminal
  `permissionRequest` `EventKind`, resolvable by a new `resolvePermission`
  `CommandKind`. This mirrors ADR 0012's own precedent for extending the
  protocol additively.
- `copilot-cli-acp` spawns `copilot --acp`; `gemini-cli-acp` spawns
  `gemini --experimental-acp`; both are expected (pending each adapter's
  own live-verification task) to support the full request/permission
  round-trip, since they implement the ACP spec natively.
- `codex-cli-acp` spawns an externally installed `codex-acp` binary,
  presence-detected on `PATH` exactly like the four tools this project
  already shells out to. `@agentclientprotocol/codex-acp` (and its
  `@openai/codex` dependency, which bundles a native, platform-specific
  binary fetched via postinstall) is deliberately NOT added to
  `packages/core/package.json` — it would otherwise force every
  contributor's `npm install` to download that binary regardless of
  whether they use Codex.
- `claude-cli-acp` spawns `claude --input-format stream-json
  --output-format stream-json --verbose` directly (not the official SDK
  bridge) and translates structured progress only. It never emits
  `permissionRequest` — this is a documented, tested limitation (see the
  new `acp-agent-adapters` capability's spec), not a defect to be
  silently worked around.

This change explicitly does not wire the new event kinds into
`agentic-harness`'s `checkpoint`/`autonomous` chain logic, and does not
implement the deferred `git` stepAgent — both remain their own, separate,
future decisions once real-world use of these adapters exists to design
against.

## Rejected Alternatives

**Change the four existing raw-text adapters in place, instead of adding
new ones.** Rejected: breaking for any already-persisted per-change
`harness.json` referencing today's agent ids, and removes the
drift-resistant text-passthrough fallback exactly when a young,
already-once-renamed ecosystem (`@zed-industries/*` →
`@agentclientprotocol/*`) might need it.

**Use `@agentclientprotocol/claude-agent-acp` (the official SDK-based
bridge) for Claude.** Rejected: requires `ANTHROPIC_API_KEY`, cannot reuse
an OAuth-authenticated `claude` session, and either forces separate
metered billing or conflicts with Anthropic's own subscription-OAuth
policy — both incompatible with this project's "never handles API keys or
credentials directly" posture.

**Recover a working Claude permission prompt via an interactive PTY and
screen-scraping.** Rejected: reintroduces the fragile, version-drift-prone
text parsing `spawnAndStream`'s existing design explicitly avoids, for a
less reliable result than the ACP spec's actual guarantee.

**Depend on `@agentclientprotocol/codex-acp` directly as an npm
dependency.** Rejected: transitively pulls `@openai/codex`'s native
platform binary into every contributor's install regardless of use.

**Use MCP instead of ACP.** Rejected: MCP lets an already-running agent
call tools on a server; it gives an external orchestrator no way to
start, observe, or gate that agent's own execution, so it cannot
substitute for what this decision needs.

## Consequences

- `packages/core/src/protocol.ts` gains three additive members
  (`agentUpdate`, `permissionRequest` `EventKind`s; `resolvePermission`
  `CommandKind`); `server`/`extension` gain thin pass-through, no new
  business logic, per ADR 0001.
- Four agents each have two parallel `AgentAdapter` implementations
  (raw-text and ACP-flavored) until/unless a future decision deprecates
  the raw-text ones.
- `gemini-cli-acp`'s and `codex-cli-acp`'s permission-relay is assumed,
  not yet live-verified — each adapter's own tasks require live
  verification before being considered complete.
- `claude-cli-acp` provides observability without a permission gate; this
  is a structural limitation of Claude's current CLI surface, not
  something this decision can close without either metered API billing or
  a policy conflict.
- Related OpenSpec change: `openspec/changes/acp-agent-adapters/`.

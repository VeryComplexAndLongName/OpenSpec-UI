## Context

See `proposal.md` for motivation. Load-bearing facts for the decisions below,
gathered via live investigation before this design was written (not
assumptions):

- `packages/core/src/agents/shared.ts`'s `spawnAndStream` deliberately treats
  CLI output as opaque text ("conservative parsing... does not attempt to
  guess a structured format") so a CLI's output-format drift across versions
  cannot break the event stream. This is the behavior ACP-flavored adapters
  add an alternative to, not replace.
- Live spike (this session, real `claude` v2.1.237 process, isolated cwd):
  `claude -p --input-format stream-json --output-format stream-json --verbose
  --permission-mode manual` produces a rich, structured tool-call stream
  (`content_block_delta`/`input_json_delta` incrementally building tool
  arguments) but resolves a permission decision itself and fails closed —
  `system`/`permission_denied`, then the turn ends (`terminal_reason:
  "completed"`) — with no `control_request`-shaped message ever offered
  back over stdin to answer. Verified on disk: the file was never written.
  `claude-cli` therefore gets observability, not a permission gate, from
  this change.
- `copilot --acp` ("Start as Agent Client Protocol server") verified present
  in `copilot --help` on this machine, GitHub Copilot CLI v1.0.78.
  `gemini --experimental-acp` is documented as a native flag in Google's own
  docs (geminicli.com/docs/cli/acp-mode) but not installed on this machine —
  not live-verified this session.
- `@agentclientprotocol/codex-acp` (npm, v1.7.0) is genuine TypeScript
  (`package.json`/`tsconfig.json`/`build.mjs`, ESM, Apache-2.0), ships its
  own `bin: codex-acp`, and supports ChatGPT-login auth — but lists
  `@openai/codex` `^0.148.0` as a normal `dependency`, and `@openai/codex`
  bundles a native, platform-specific binary fetched in a postinstall step
  (historically ~100MB, optimized toward ~20MB per upstream openai/codex
  issue #2766) — confirmed via this session's inspection of its manifest.
- `@agentclientprotocol/sdk` has zero required dependencies (one peer dep,
  `zod`), ships as ESM with separable exports (`./dist/acp.js` core
  schema/`agent()`/`client()` API; `./experimental/node` for Node
  transport) — confirmed via this session's inspection of its manifest.
- ADR 0012 already established the precedent this design follows for
  extending the protocol additively (new non-terminal `CommandKind`/
  `EventKind` members, existing behavior unchanged, thin pass-through in
  `server`/`extension`).

## Goals / Non-Goals

**Goals:**

- Give `copilot-cli`, `gemini-cli`, `codex-cli`, and `claude-cli` an
  ACP-flavored `AgentAdapter` counterpart that reports structured
  progress/tool-call/diff information instead of only raw `stdout` text.
- Relay `session/request_permission` as a `permissionRequest` event,
  resolvable via a new `resolvePermission` command, for whichever of these
  adapters' underlying agent process genuinely issues it.
- Keep the four external tools' presence-detection and "never bundle a
  credential or a heavy transitive binary" posture identical to today's
  adapters.
- Structure the driver so a fifth future ACP-capable agent needs only a new
  thin per-agent piece (how to reach its ACP mode), not a new protocol
  translation layer.

**Non-Goals (this change):**

- Wiring `agentUpdate`/`permissionRequest` into `agentic-harness`'s
  `checkpoint`/`autonomous` chain logic — that chain still only pauses
  between stages, exactly as `agentic-harness-autonomy` shipped it. A
  per-action pause inside a chain's `apply` stage is a plausible follow-up,
  not part of this change.
- The deferred `git` stepAgent (real commit/push/PR/merge) and its own
  security model — still fully out of scope, per ADR 0011/0012, and tracked
  separately in `agentic-harness-git-stage` / ADR 0014. That work uses the
  *existing* per-stage `checkpoint`/`autonomyLevel`/`reviewGate.mode`
  mechanism (`HarnessStage` already reserves `"git"`), not this change's
  `agentUpdate`/`permissionRequest` — the two are independent; this change
  is not a prerequisite for that one.
- `local-llm` — raw HTTP to an OpenAI-compatible endpoint has no ACP
  relevance and is untouched.
- Removing, deprecating, or changing the behavior of today's five raw-text
  adapters.
- Making `claude-cli-acp` emit permission requests. This is a structural
  limitation of what `claude`'s documented, non-SDK CLI surface exposes
  (see Context), not a gap this change attempts to close.

## Decisions

### ACP-flavored adapters are new, additional `AgentAdapter`s, not replacements

Each of `copilot-cli`, `gemini-cli`, `codex-cli`, `claude-cli` gets a second,
separately selectable registry entry (exact id scheme is an Open Question
below) rather than having its existing entry's behavior changed in place.

**Rejected alternative**: change the existing four adapters in place to
speak ACP. Rejected because (a) it would be a breaking change to any
already-persisted per-change `harness.json`/config referencing today's
agent ids, and (b) today's blind-but-drift-resistant text passthrough
remains a useful fallback — ACP is a young, already-once-renamed ecosystem
(see below), and a hard cutover removes the fallback exactly when it might
be needed.

### Shared ACP session driver built on `@agentclientprotocol/sdk`

One driver module in `packages/core` owns ACP session lifecycle (open
session, subscribe to `session/update`, relay `session/request_permission`)
and translates it into this project's `Event` union; each per-agent adapter
only supplies how to reach that agent's ACP-speaking process.

**Rejected alternative**: hand-roll JSON-RPC/ACP framing instead of taking
the SDK dependency. Rejected — the SDK has zero required dependencies (one
peer, `zod`), is the same reference implementation the vendor CLIs
implement against (lower drift risk than a hand-rolled reimplementation),
and its exports are already split (core schema vs. `./experimental/node`
transport) in a way that keeps it out of the browser bundle without extra
work on this project's part.

### `codex-acp` is invoked as an external binary, never an npm dependency of `packages/core`

The `codex-cli` ACP-flavored adapter spawns an externally installed
`codex-acp` executable (`npm install -g @agentclientprotocol/codex-acp` or
equivalent, documented the same way `claude`/`copilot`/`codex`/`gemini`
installation already is), presence-detected on `PATH` exactly like the
other four tools.

**Rejected alternative**: add `@agentclientprotocol/codex-acp` to
`packages/core/package.json`'s `dependencies`. Rejected because it
transitively pulls `@openai/codex`'s native, platform-specific binary
(fetched in postinstall) into every contributor's `npm install`, regardless
of whether they ever select Codex — a real, measured cost (tens of MB),
not a hypothetical one, and inconsistent with this project's existing
posture that external CLI tools are the user's own install, never bundled.

### `claude-cli-acp` translates progress only; the official SDK-based bridge is rejected

The `claude-cli` ACP-flavored adapter spawns `claude --input-format
stream-json --output-format stream-json --verbose` directly and translates
its structured tool-call/message stream into `agentUpdate` events. It never
emits `permissionRequest`.

**Rejected alternative**: use `@agentclientprotocol/claude-agent-acp` (the
official bridge). Rejected — it is built on the Claude Agent SDK, which
requires `ANTHROPIC_API_KEY` directly and cannot reuse an already-
authenticated `claude login` (OAuth) session; Anthropic's policy bars OAuth
tokens issued to Free/Pro/Max subscriptions from any use outside Claude
Code/claude.ai, including the Agent SDK (github.com/openclaw/openclaw/
issues/53456). Depending on it would either force every user of this
adapter onto separate, metered API billing or silently violate that policy
— both unacceptable, and contrary to this project's own stated invariant
that it "never handles API keys or credentials directly."

**Rejected alternative**: recover a working permission prompt by driving
`claude` in genuine interactive mode under a PTY and screen-scraping its
prompt. Rejected — this reintroduces exactly the fragile, version-drift-
prone text parsing `spawnAndStream`'s existing "conservative parsing"
design explicitly avoids, at higher complexity than today's approach, for
an outcome (a best-effort scrape) less reliable than the ACP spec's actual
guarantee.

### MCP is not a substitute for any part of this change

**Rejected alternative** (raised and resolved earlier in this change's own
exploration, recorded here per the design-doc rule to list rejected
alternatives): use MCP instead of ACP. Rejected — MCP lets an already-
running agent call tools exposed by a server; it gives an external
orchestrator no way to start, observe, or gate that agent's own execution.
It solves a different problem (an agent pulling more context/capability
during a run) and cannot substitute for what this change needs (the
orchestrator observing/gating the agent's own execution).

### New protocol members: `agentUpdate`, `permissionRequest`, `resolvePermission`

Additive `EventKind` members `agentUpdate` (a structured progress/plan/
tool-call/diff update) and `permissionRequest` (an agent-issued permission
ask); additive `CommandKind` member `resolvePermission` (answers a
`permissionRequest` by id with an `"allow"`/`"deny"` outcome). Both new
event kinds are non-terminal, exactly like `agentic-harness-autonomy`'s
`stageCompleted`/`checkpoint` — a client that does not recognize them still
sees a coherent, if less detailed, event log; `completed`/`failed`/
`cancelled` remain the only terminal kinds. `server`/`extension` need only
their existing generic pass-through (per ADR 0001's "no new business logic
in transport adapters"), verified by the same style of contract test
`agentic-harness-autonomy`'s tasks.md 4.3 already used for `chain`/
`checkpoint`.

**Backward compatibility**: confirmed by construction — non-terminal,
additive members that neither `server`'s WS layer nor `extension`'s
message-bridge currently special-case (both already serialize/deserialize
`CommandKind`/`EventKind` generically per `protocol.ts`, per
`agentic-harness-autonomy`'s design.md's own finding for `chain`/
`checkpoint`).

## Risks / Trade-offs

- **[Risk]** `gemini --experimental-acp` and `codex-acp`'s permission-relay
  are assumed, not live-verified on this machine (only `copilot`'s native
  `--acp` flag and `claude`'s lack of one were confirmed live this
  session). → **Mitigation**: tasks.md requires a live-verification task per
  adapter — including whether `session/request_permission` genuinely
  round-trips — before that adapter's tasks may be marked complete, per
  this project's existing live-smoke-test requirement.
- **[Risk]** Users may assume `claude-cli-acp` adds the same safety net as
  the other three ACP-flavored adapters. → **Mitigation**: this is now a
  tested, spec'd behavior (see `specs/acp-agent-adapters/spec.md`'s "Claude
  CLI adapter never emits a permission request" scenario), and the UI
  presenting this adapter must say so explicitly (a tasks.md item), not
  leave it to be discovered.
- **[Risk]** The ACP ecosystem is young and has already had one naming/
  ownership churn (`@zed-industries/claude-code-acp` →
  `@agentclientprotocol/claude-agent-acp`; `@zed-industries/codex-acp` →
  `@agentclientprotocol/codex-acp`). → **Mitigation**: pin exact versions via
  changeset; isolate each per-agent piece behind the shared driver so a
  future rename/churn touches one small module, not the driver or the other
  three adapters.
- **[Trade-off]** Four agents now have two parallel `AgentAdapter`
  implementations each (raw-text and ACP-flavored) until/unless a future
  change deprecates the raw-text ones — more adapters to maintain, accepted
  as the cost of an additive, non-breaking rollout.

## Migration Plan

No data migration. Purely additive: new registry entries, new non-terminal
protocol members, new optional external-binary dependency for one adapter
(`codex-acp`). Every existing configuration, persisted `harness.json`, and
already-implemented `server`/`extension` transport continues to work
unchanged; nothing defaults to the new adapters.

## Open Questions

- Exact registry id / naming scheme for the four new adapters (e.g.
  `claude-cli-acp` as a sibling id vs. a `variant` field on the existing
  entry) — first tasks.md item, does not change the spec or the chosen
  approach either way.
- Whether `gemini-cli`'s and `codex-acp`'s permission-relay actually
  round-trips end-to-end in practice — resolved by each adapter's own
  live-verification task before it is marked done, not before
  implementation starts on the shared driver.

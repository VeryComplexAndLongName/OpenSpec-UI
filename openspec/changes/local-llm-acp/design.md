# Design

## Context

See `proposal.md` for motivation. The repository already has:
- `local-llm` as a direct HTTP adapter to OpenAI-compatible `/v1/chat/completions`.
- ACP adapters using the shared `AcpSessionDriver`.
- Harness-level controls for change/task runtime boundaries (`timeout.maxRunSeconds`, `timeout.maxStageSeconds`, `maxStageAttempts`) and context ceilings (`budget.maxContextShare`).

The gap is a local adapter that combines OpenAI-compatible backend settings with ACP behavior and ACP tool/permission flow.

## Goals / Non-Goals

**Goals:**
- Add a new adapter id `local-llm-acp` in `packages/core`.
- Reuse existing local LLM settings (`baseUrl`, `model`, optional `apiKey`) with no file persistence for secrets.
- Define a stable invocation contract for ACP loop limits (iterations, tool-call count, run seconds, prompt/completion/total tokens, context ceilings).
- Wire the adapter through registry, default runners, allowlist, and harness capabilities.

**Non-Goals:**
- No new command kinds or event kinds.
- No replacement of existing `local-llm` HTTP adapter.
- No UI redesign or host-specific custom transport logic.
- No custom in-process ACP server implementation in this change.

## Decisions

1. Add `local-llm-acp` as a separate adapter id, not a mode switch on `local-llm`.
- Chosen: separate `AgentAdapter` id and class, following existing ACP adapter pattern.
- Rejected alternative: fold ACP mode into `local-llm` with a variant flag.
- Rejection reason: would mix HTTP and process ACP semantics into one adapter and make allowlist/capability validation less explicit.

2. Use the shared `AcpSessionDriver` for ACP protocol handling.
- Chosen: only adapter-specific logic is invocation building and prompt prefixing.
- Rejected alternative: implement ACP session protocol directly inside the new adapter.
- Rejection reason: duplicates tested protocol translation and increases drift risk.

3. Reuse local endpoint credentials/settings and keep API key out files.
- Chosen: source `baseUrl/model/apiKey` from the existing local LLM settings resolver path.
- Rejected alternative: introduce a second, ACP-only settings namespace for the same values.
- Rejection reason: diverging configuration surfaces for one endpoint is error-prone.

4. Keep time-to-stop controls layered: harness controls chain/stage/task boundaries, adapter controls loop ceilings.
- Chosen: preserve existing harness controls for change/task time and attempts, plus adapter-level ACP loop limits for local process behavior.
- Rejected alternative: force all limits into one layer only.
- Rejection reason: harness and agent runtime solve different boundaries and neither fully replaces the other.

Protocol compatibility note:
- This change does not add or alter `CommandKind` or `EventKind` in `packages/core/src/protocol.ts`.
- Backward compatibility with existing server/extension adapters is preserved because they already pass through existing ACP events.

## Risks / Trade-offs

- [Risk] External local ACP executable not installed or incompatible.
  -> Mitigation: explicit executable/args allowlist entry and clear process-start failure path already exposed through runner events.

- [Risk] Capability overstatement for usage/context reporting when backend behavior differs.
  -> Mitigation: declare conservative capability metadata (`unknown` where not measured), then tighten only with verified evidence.

- [Risk] Too many limit knobs can confuse operators.
  -> Mitigation: keep contract explicit and bounded to a known flag set, and document precedence (harness ceilings vs adapter loop limits).

## Migration Plan

1. Add and unit-test the new adapter plus invocation contract.
2. Register adapter id in registry/default runners/allowlist/capability tables.
3. Add/update tests that enforce allowlist and harness config behavior for the new id.
4. Run typecheck/lint/tests for affected workspace packages.
5. Keep `local-llm` unchanged so current users are not disrupted.

## Open Questions

- Which local ACP executable name should be considered canonical in this repository by default (`coding-agent` vs another wrapper). This change starts with one default and can add aliases in a follow-up if needed.

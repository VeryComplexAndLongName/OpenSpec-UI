# Proposal

## Why

ADR 0001 keeps execution behavior in core and requires adapters, but today the local OpenAI-compatible path is HTTP-only and cannot participate in ACP permission flow, structured updates, and ACP-native coding tools. We need a local ACP agent that keeps the same local endpoint settings while making long-running coding runs controllable through existing harness limits and retries.

## What Changes

- Add a new core agent adapter `local-llm-acp` that runs a local ACP coding agent process and bridges it through the shared ACP session driver.
- Reuse existing local LLM settings (`base URL`, `model`, optional `API key`) for the new ACP adapter.
- Define and validate a concrete invocation contract for ACP loop limits (iterations/tool calls/time/token/context limits) that are passed to the ACP coding process.
- Register `local-llm-acp` in the agent registry, default runner map, allowlist, and harness capabilities table.
- Add unit coverage for invocation shape, allowlist acceptance/rejection, and capabilities/config validation.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `execution-core`: extend local LLM support so the system can run a local OpenAI-compatible coding agent over ACP, including a strict invocation/limits contract and secure key handling.

## Impact

- Affected code: `packages/core` adapters, settings resolution, runner allowlist, harness capability metadata, and tests.
- No new host-specific behavior in `server`/`extension`; both consume the same core registry and runner wiring.
- No command/event protocol shape changes are required; the feature uses existing ACP event kinds (`agentUpdate`, `permissionRequest`, `usageReported`) and existing harness limits (`timeout`, `maxStageAttempts`, `maxContextShare`).

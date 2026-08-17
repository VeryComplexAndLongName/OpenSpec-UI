## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` decision #4 requires
the CLI-agent orchestration security model — command allowlist, cwd
sandbox, audit — as a first-class part of agent execution, not an
afterthought. `agent-selection` (merged) built on top of that model: the
picker in `AiPanel` lists all five `AGENT_REGISTRY` entries with no
signal about which underlying CLI is actually present on the machine.
Every one of the five adapters spawns its executable directly (see
`agents/shared.ts`'s `cross-spawn` rationale) and only discovers
"not installed" as a `failed` event *after* the user has already picked
an agent and started a run — a review-time gap: the same allowlist model
that gates *what* a resolved runner may execute has no equivalent
presence check before resolution, so a user with 4 of 5 CLIs installed
gets the same undifferentiated picker as a user with none, and only finds
out which is which by triggering (and cleaning up after) a failed run.

## What Changes

- Add `detectAvailableAgents()` to `packages/core` — a best-effort,
  parallel presence check (`<executable> --version` via `cross-spawn` for
  the four CLI adapters, an HTTP reachability check for `local-llm`'s
  `__http__` sentinel), reusing `buildDefaultAllowlist()`'s executable
  names as the single source of truth instead of a second hardcoded
  id→executable map.
- Expose it as `POST /api/agents/detect` in `packages/server` for the
  standalone/local-server hosts, and as a direct core call folded into
  the VS Code extension's existing Webview "context" message for the
  message-bridge host — no change to the Command/Event protocol.
- `AiPanel` gets an optional `detectedAgents` prop: each agent option in
  the picker is annotated (detected / not detected), not filtered or
  hidden. Detection is a presence signal, not a guarantee the tool is
  authenticated or otherwise usable — the existing `failed`-event path
  from `agent-selection` remains the actual source of truth for "can this
  run".

## Capabilities

### New Capabilities

(none — this augments the `agent-selection` picker with a presence
signal; see Modified Capabilities.)

### Modified Capabilities

- `standalone-app`: the agent picker can show, on request, which agents
  were detected on the machine running the server.
- `vscode-extension`: the message-bridge Webview's agent picker gets the
  same annotation, computed via a direct core import when the dashboard
  panel is revealed.

## Impact

- `packages/core/src/agent-detection.ts` (new), `index.ts` (export; not
  `browser.ts` — depends on `cross-spawn`/Node, same as `default-runners.ts`).
- `packages/server/src/rest.ts`, `server.ts` (new endpoint).
- `packages/webui/src/components/AiPanel.tsx` (new prop + rendering),
  `standalone-entry.tsx` (fetch + refresh wiring).
- `packages/extension/src/extension.ts` / wherever the Webview "context"
  message is built (extend `DashboardContext` with `detectedAgents`).
- No change to the command/event protocol shape.

## Context

Every one of the five `AGENT_REGISTRY` adapters resolves to a real
executable spawned via `cross-spawn` (`agents/shared.ts`) or, for
`local-llm`, an HTTP endpoint (`agents/local-llm.ts`). `security.ts`'s
`buildDefaultAllowlist()` (`default-runners.ts`) already maps each agent
id to its executable name (`"claude-cli" → "claude"`, etc., `"local-llm"
→ "__http__"` sentinel) — this is the same mapping `agent-detection`
needs, so it is reused rather than duplicated.

`agent-selection` (merged) added the picker but no presence signal;
"not installed" is currently only discoverable by running a command and
reading the resulting `failed` event's reason string.

Two hosts need the result, computed differently:
- Standalone/local-server: the server process is the one with the CLIs on
  its `PATH`, so detection must happen server-side, behind a new REST
  endpoint the browser bundle calls.
- Extension message-bridge: the extension host process itself has the
  CLIs on its `PATH` (same process that already builds `runners` via
  `buildDefaultAgentRunners`), so detection is a direct, synchronous-call
  but asynchronous-result core import — no HTTP round trip needed or
  wanted.

`AiPanel.reveal()` (`packages/extension/src/webview/ai-panel.ts`) already
posts a `context` message (`{cwd, changeDir}`) both on first panel
creation and on every subsequent reveal; `extension-entry.tsx`'s
`ExtensionApp` already has a `window.addEventListener("message", ...)`
handler that applies a `context` message's fields to React state *after*
initial mount, not just at boot. Both of these existing mechanisms are
reused as-is for `detectedAgents`, not replaced.

## Goals / Non-Goals

**Goals:**
- Surface, per agent id, a best-effort "is this CLI/endpoint present"
  signal in both hosts.
- Never add latency to opening the AI panel or picking an agent —
  detection runs in the background and updates the picker when it
  resolves.

**Non-Goals:**
- Not a filter or hide mechanism. Every `AGENT_REGISTRY` entry always
  stays selectable regardless of detection result — see Decisions.
- Not a guarantee the tool actually works. `--version` succeeding (or
  even failing but *spawning*) only proves the binary resolves on
  `PATH`; it says nothing about authentication, network access, or quota.
  The existing `failed` event from `agent-selection` remains the actual
  source of truth for whether a run can succeed.
- No caching/persistence of detection results across process restarts or
  across the two hosts — each host detects independently, using its own
  process's `PATH`, because VS Code's environment and a plain terminal's
  environment can legitimately differ (a CLI installed for one may not be
  visible to the other).
- No extension of the Command/Event protocol. Detection is plumbed as an
  ordinary REST endpoint (standalone) and as an extension of the
  already-existing side-channel `context` message (extension) — not a new
  `CommandKind`.

## Decisions

### Annotate, don't filter

The picker always lists all five registered agents; detection only adds
a label suffix per `<option>`. Rejected hiding/disabling undetected
agents: a false negative (CLI actually installed but not on the specific
`PATH` the detecting process sees — e.g. VS Code's environment differs
from a user's shell profile, or a CLI installed after the extension host
process started) would make an agent the user knows is installed
silently disappear from the picker with no way to select it and no error
message explaining why — strictly worse than an occasionally-wrong badge
next to a still-selectable option.

### `<option>` label suffix instead of a rich badge

A native `<select>`'s `<option>` elements cannot render arbitrary
markup/CSS (no icons, no color), only text. Rejected replacing the native
`<select>` with a custom listbox component purely to get richer badges:
that's a disproportionate UI rewrite for what `agent-selection` already
established as a plain, host-neutral form control; a plain-text suffix
(e.g. an appended checkmark vs. a "not detected" note) conveys the same
information with zero new component surface.

### Detection reuses `buildDefaultAllowlist()`, not a second id→executable map

Considered adding a parallel `AGENT_DETECTION_TARGETS` map next to
`AGENT_REGISTRY`. Rejected: `buildDefaultAllowlist()` already is the
single source of truth for "what executable does this agent id actually
run" (used to build the real runners); a second map would only be able to
drift from it silently, exactly the class of bug `ADR 0001`'s "single
source of truth" invariant exists to prevent.

### `--version`'s exit code is ignored; only spawn success/failure matters

Some CLIs return non-zero from `--version` in edge cases (e.g. when it
also validates auth as a side effect). Detection only distinguishes
"process spawned and ran" (`exit` fired, any code) from "process could
not be spawned at all" (`error` fired, e.g. `ENOENT`) or "timed out"
(treated as not detected, conservatively, after 3s) — spawning at all is
what "the executable resolves on `PATH`" means; a non-zero exit is not
evidence of absence.

### Extension: detection runs after `reveal()`, posted as a follow-up `context` message

Rejected making `dashboardContext()`/`reveal()` `async` and awaiting
detection before creating/revealing the panel or posting the first
`context` message: `dashboardContext()` is called synchronously from six
call sites in `commands.ts`, and detection can take up to ~3s per
undetected CLI (bounded to the slowest single check via `Promise.all`,
still real latency) — that would add a visible stall to every "open AI
panel" action, including the common case where the user already knows
which agents are installed. Instead, `reveal()` keeps posting the
existing `{cwd, changeDir}` context message immediately/synchronously as
today, then separately kicks off `detectAvailableAgents()` and — once it
resolves — posts one more `context` message carrying `detectedAgents`
alongside the same `cwd`/`changeDir`. The webview already applies a
`context` message's fields to state on every receipt, not just at initial
mount (`extension-entry.tsx`'s message listener), so this requires no new
message type — `DashboardContext`/`AiPanelContext` both simply gain an
optional `detectedAgents` field, and `isDashboardContextMessage` does not
require it to be present (older/simpler messages without it remain
valid). This also naturally gives "refresh on every reveal" instead of
needing a separate refresh button in this host.

### Standalone: on-demand REST call, explicit refresh button

Unlike the extension (which re-detects on every panel reveal for free),
the standalone browser tab has no equivalent "panel reopened" moment —
the tab, once loaded, stays open. `standalone-entry.tsx` calls
`POST /api/agents/detect` once on `AiPanel` mount and exposes a small
"Refresh agents" button (rendered only when `onRefreshAgents` is
supplied, so the extension host does not get an unused button). The
endpoint keeps the same `{cwd}` + `authorizeCwd` request shape every
other `/api/*` endpoint uses, purely for consistency with the existing
security-gate pattern, even though detection itself never reads from or
writes to the workspace directory.

## Risks / Trade-offs

- **[Risk]** A `--version` spawn could, in principle, itself do something
  unexpected (network call, slow first-run setup). → **Mitigation**: same
  risk class already accepted for every other CLI invocation in this
  product (`agents/*.ts` already spawn these same executables for real
  commands); bounded by the existing 3s timeout, and `--version` is by
  convention among the least side-effecting invocations any CLI exposes.
- **[Risk]** Detection results can be stale by the time the user actually
  runs a command (CLI uninstalled/installed in between). → **Mitigation**:
  explicitly accepted — see Non-Goals; the `failed` event path remains
  authoritative at run time regardless of what the badge said.
- **[Risk]** `fetch` reachability check for `local-llm` only proves *a*
  server answered at that URL, not that it's actually the expected local
  LLM endpoint. → **Mitigation**: accepted, same "presence, not
  correctness" scope as the CLI checks; the existing `LocalLlmAdapter`
  run path is still what actually exercises the real API contract.

## Migration Plan

- No data migration; purely additive (`detectedAgents` is a new optional
  field on both `DashboardContext`/`AiPanelContext` and on `AiPanelProps`,
  and a new REST endpoint).
- Version bump (minor) for `@openspec-ui/core`, `@openspec-ui/server`,
  `@openspec-ui/webui`, `openspec-ui-vscode`.
- Rollback: revert the four package changes together; no persisted state
  to unwind.

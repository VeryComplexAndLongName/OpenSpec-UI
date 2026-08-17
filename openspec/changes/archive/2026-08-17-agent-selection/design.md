## Context

See `proposal.md - Why` for the concrete finding. Two independent AI
mechanisms coexist in this codebase and this change only touches one of
them:

1. **This product's own CLI-runner protocol** (`Command.agentId` →
   `resolveRunner` → `AgentRunner.run()`, streamed as `Event`s over the
   existing WebSocket/REST transport) — fully specified and tested in
   `packages/core`, but never instantiated by any real launcher.
2. **VS Code's native Chat/Agent mode** (`workbench.action.chat.open`,
   the `openspec` Chat Participant's `request.model`) — already working
   today, already lets the user pick a model via VS Code's own Copilot
   Chat model picker, entirely outside this app.

This change wires up (1) and exposes it in `AiPanel`. It does not touch,
remove, or change (2) — that stays exactly as-is.

Every command already flows through the existing checkpoint/audit/journal
infrastructure (`WorkbenchRecoveryService`, `WorkbenchRunJournal`,
`security.ts`'s allowlist and `AuditLog`) regardless of which UI issued it
— the "Processes and Recovery" tab/tree already gives host-agnostic
rollback for any run, including ones started through `AiPanel`. This
change adds no new safety mechanism because it does not need one; it
activates an existing one.

## Goals / Non-Goals

**Goals:**
- Standalone gets a working way to invoke an agent at all (currently has
  none).
- VS Code's message-bridge and optional-local-server modes gain the same
  mechanism, so agent switching behaves identically in both hosts, in one
  place (`AiPanel`).
- No new abstraction: reuse `AGENT_REGISTRY`, `buildDefaultAgentRunners`,
  `resolveRunner`, `DEFAULT_AGENT_ID` exactly as already specified.

**Non-Goals:**
- Not touching VS Code's native Chat/Agent path
  (`startImplementation`/Chat Participant) — it keeps using VS Code's own
  model picker, unrelated to this mechanism.
- Not adding configuration UI for the `local-llm` adapter's base
  URL/model (`buildDefaultAgentRunners`'s `localLlmBaseUrl`/`localLlmModel`
  options keep their existing defaults, `http://localhost:30000` /
  `"default"`). A settings surface for that is a reasonable follow-up, not
  built here.
- Not detecting which CLI tools are actually installed ahead of time
  (e.g. graying out unavailable options in the picker). The picker lists
  the full `AGENT_REGISTRY`; an unavailable tool fails the run with a
  clear `failed` event (already-existing spawn-error handling), same as
  before this change for the direct commands.
- Not adding a confirmation dialog before running `implement` through
  `AiPanel`. The existing checkpoint/rollback system already covers this
  regardless of entry point (see Context) — see also
  `startImplementation`'s own lack of an extra confirmation beyond
  opening the native chat prompt.

## Decisions

### `AiPanel` is the one place agent selection lives, in both hosts

Add `"plan"`, `"implement"`, `"review"` to `AiPanel`'s
`RUNNABLE_COMMANDS`/`CHANGE_REQUIRED_COMMANDS`, plus a `<select>` sourced
from `AGENT_REGISTRY`, included as `Command.agentId`. Since `AiPanel` is
the shared component already rendered by both `standalone-entry.tsx` and
`extension-entry.tsx`, this single change gives both hosts the mechanism
at once — no separate VS-Code-specific picker needed.

Rejected alternative: a VS Code-only agent picker (e.g. a
`contributes.configuration` setting or a QuickPick command), leaving
standalone without one. Rejected because standalone has no other AI
mechanism at all — it needs this regardless — and a second, differently-
shaped picker in VS Code would violate the "one place" goal for no
benefit.

### `buildDefaultAgentRunners` is called at each of the three real entry points, not centralized further

`cli.ts` and `optional-server.ts` each call
`buildDefaultAgentRunners({ workspaceRoot, allowExternalCwd })` and pass
the result as `createServer(...)`'s `runners` option (already an existing,
optional field). `extension.ts` calls it once at activation (workspace
root is already known then) and passes
`resolveRunner: (agentId) => resolveRunner(runners, agentId)` into
`AiPanel`'s deps, replacing `() => undefined`.

Rejected alternative: building the runners map once in `core` and having
each host import a singleton. Rejected — `workspaceRoot` differs per host
instance (and, for the extension, is only known at activation), so a
module-level singleton in `core` cannot be correct; each host already
owns constructing its own `runners` map from `createServer`'s existing
`runners?: Map<...>` option, this just stops leaving it empty.

### `DEFAULT_AGENT_ID` moves to `agents/registry.ts`

`registry.ts` has no Node-only dependencies (`AGENT_REGISTRY` is a plain
array of `{id, label}`), so it is already re-exported from
`browser.ts` for `AiPanel`'s use. `DEFAULT_AGENT_ID` currently lives in
`default-runners.ts`, which imports the CLI adapters (Node-only,
`cross-spawn`) and is therefore not browser-safe. Moving the constant
(not the function) to `registry.ts` and having `default-runners.ts`
import it from there keeps a single source of truth while making it
available to the browser bundle for the picker's default selection.

Rejected alternative: redeclaring `"claude-cli"` as a separate literal in
`AiPanel.tsx`. Rejected — two places asserting "the default agent is X"
is exactly the kind of duplication that drifts silently if the default
ever changes.

## Risks / Trade-offs

- **[Risk]** Users without any of the five CLI tools installed will see a
  picker full of options that all fail. → **Mitigation**: accepted per
  Non-Goals (no install-detection here); the failure is immediate and
  clearly reported via the existing `failed` event, not a silent hang or
  a confusing generic error.
- **[Risk]** Running `implement` via `AiPanel` bypasses
  `ImplementationSessionManager`'s VS-Code-specific session bookkeeping
  (e.g. the "Finish Implementation & Review" command's `processId`
  tracking is specific to sessions started via `startImplementation`). →
  **Mitigation**: the underlying checkpoint/rollback still applies (see
  Context) via `WorkbenchRecoveryService`/`WorkbenchRunJournal`, which is
  host-agnostic; only the VS-Code-specific *convenience command* for
  finishing a session is scoped to the native-chat path. Not fixed here —
  a real gap, but a pre-existing one this change does not worsen (before
  this change, `AiPanel`-driven `implement` was not possible in VS Code at
  all, so there is no regression, only a documented seam).

## Migration Plan

- No data migration. `Command.agentId` is already an existing, optional
  protocol field — no protocol version bump.
- Version bump (minor) for `@openspec-ui/core` (moved constant, still
  re-exported the same way), `@openspec-ui/server`, `@openspec-ui/webui`,
  `openspec-ui-vscode`, per `openspec/config.yaml`.
- Rollback: revert the four package changes together. No persisted state
  changes shape.

## 1. Config schema and read/merge/write

- [ ] 1.1 Define the `HarnessConfig` type and Zod (or equivalent)
  schema in `packages/core/src/harness-config.ts`: `stepAgents`
  (`propose`/`review`/`apply`/`archive`/`git` → `agentId`),
  `autonomyLevel` (`assisted`/`semi-autonomous`/`autonomous`),
  `reviewGate.mode` (`human-required`/`agent-sufficient`).
- [ ] 1.2 `readGlobalHarnessConfig(workspaceRoot)`: reads `openspec/
  agent-harness.json`; returns a documented all-`assisted`/
  `human-required` default when the file doesn't exist (never throws for
  a missing file).
- [ ] 1.3 `readChangeHarnessConfig(workspaceRoot, changeName)`: reads
  `openspec/changes/<changeName>/harness.json` if present; returns
  `undefined` if absent.
- [ ] 1.4 `resolveHarnessConfig(workspaceRoot, changeName?)`: deep-merges
  the per-change override (if any) over the global config, per-key, per
  design.md's merge semantics. Reject (throw a clear, caught-by-caller
  error) a global file that sets `reviewGate.mode: "agent-sufficient"` —
  that value is only valid in a per-change file, never global.
- [ ] 1.5 `writeGlobalHarnessConfig`/`writeChangeHarnessConfig`: validate
  before writing; never write a structurally invalid file.
- [ ] 1.6 Unit tests: default-when-missing, partial per-key override
  merge (confirm un-overridden keys are inherited), rejection of a
  global `agent-sufficient` value, round-trip write-then-read.

## 2. `WorkbenchProcess.agentId` and percent-complete

- [ ] 2.1 Add optional `agentId?: string` to `WorkbenchProcess`
  (`process-scheduler.ts`); set it when `StartProcessOptions` is given
  one (new optional field there too).
- [ ] 2.2 Processes view (webui + extension): show the process's
  `agentId` when present.
- [ ] 2.3 For a process with a `changeName`, compute and show
  percent-complete from that change's `completedTasks`/`totalTasks`
  (existing `readTaskChecklist`) — not from the `progress` field.
- [ ] 2.4 Unit tests for both.

## 3. Agent Selection pre-fill (assisted level)

- [ ] 3.1 When the AI panel opens for a change, resolve that change's
  harness config and pre-select the `agentId` matching the panel's
  current command (`plan`≈`propose`/`review`, `implement`≈`apply`) in
  the existing agent picker, instead of the last-used agent. The user
  can still change the selection before running.
- [ ] 3.2 No change if no harness config exists for the workspace/change
  (falls back to today's existing last-used-agent behavior exactly).
- [ ] 3.3 Tests confirming pre-fill only changes the *default* selection,
  never blocks or overrides an explicit user pick before Run.

## 4. Harness Settings GUI (both delivery targets)

- [ ] 4.1 Standalone webui: new settings section/tab to view/edit
  `openspec/agent-harness.json` (global) — form fields for
  `stepAgents`/`autonomyLevel` (with `semi-autonomous`/`autonomous`
  visibly marked "not yet implemented" per design.md's mitigation), and
  `reviewGate.mode` shown read-only as `human-required` at this level
  (global `agent-sufficient` is not offered as a choice at all).
- [ ] 4.2 Standalone webui: per-change "Configure Harness for this
  Change" action editing `openspec/changes/<id>/harness.json`, showing
  inherited-vs-overridden values clearly (e.g. greyed-out inherited
  fields vs. explicitly set ones).
- [ ] 4.3 VS Code extension: equivalent tree entry ("Harness Settings")
  under the Changes tree root (alongside the existing "Repository
  Setup" node) for the global config, and a per-change context-menu
  action mirroring 4.2.
- [ ] 4.4 Real Extension Host smoke test (per this project's established
  live-verification requirement) confirming the tree entry/command
  actually reads and writes the real files, not just a mocked `vscode`
  module.

## 5. Spec, ADR, and verification

- [ ] 5.1 `openspec/specs/agentic-harness/spec.md` delta (this change's
  `specs/agentic-harness/spec.md`) — new capability, `ADDED
  Requirements`.
- [ ] 5.2 Do not begin implementation (tasks 1–4) until
  `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md`'s status
  is `Accepted` — this tasks.md itself may be written and reviewed
  first, but code should not land against a still-`Proposed` ADR.
- [ ] 5.3 `openspec change validate --strict agentic-harness`.
- [ ] 5.4 typecheck/lint/test for `core`, `webui`, `extension`; real
  Extension Host smoke test (see 4.4) before this change may be archived.
- [ ] 5.5 Version bump via `npx changeset` (per this repo's adopted
  workflow — see `.changeset/README.md`) for every affected package,
  in the same PR as the code — not a hand-edited `package.json` version.

## Explicitly out of scope for this change (tracked for follow-up changes, not tasks here)

- `semi-autonomous` step-chaining and its command/event protocol
  extension.
- `autonomous` execution.
- The `git` stepAgent's actual commit/push action.
- Parallel task execution (`allow_in_parallel`) and its worktree-isolation
  mechanism.
- A graph/DAG visualization of harness step sequencing.

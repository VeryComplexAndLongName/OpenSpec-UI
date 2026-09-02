## 1. Command implementation

- [x] 1.1 `packages/extension/src/commands.ts`: new
  `openspec-ui.createChangeTemplate` handler — prompts for the change id
  (same validation as `openspec-ui.createChange`), creates it via
  `createChange()`, then asks "Use global Agentic Harness defaults" vs
  "Customize for this change."
- [x] 1.2 Customize path (`promptHarnessCustomization` helper): sequential
  `showQuickPick` for `propose`/`review`/`apply`/`archive` (each:
  "(inherit from global default)" + every `AGENT_REGISTRY` label), then
  `autonomyLevel` (`assisted`/`semi-autonomous`/`autonomous`, with a
  `detail` line explaining each), then `reviewGate.mode`
  (`human-required`/`agent-sufficient`, with a `detail` noting
  `agent-sufficient` is currently a no-op pending the deferred git
  action). Cancelling (`undefined` from any `showQuickPick`) abandons the
  whole customization — the change stays created, no harness.json is
  written, and a message says so.
- [x] 1.3 Only calls `writeChangeHarnessConfig` if the collected config
  has at least one field set (some stage wasn't "(inherit)", or
  autonomyLevel/reviewGate.mode was actually chosen) — an all-inherit
  pass writes nothing.

## 2. VS Code integration

- [x] 2.1 `packages/extension/package.json`: registered the command
  ("OpenSpec UI: Create Change Template"); added to the Changes view's
  `view/title` contributions with no `"group"` field, so it lands in the
  "..." overflow menu rather than a new toolbar icon.

## 3. Tests and verification

- [x] 3.1 Unit tests (`commands.test.ts`, 5 tests, all green, mocked
  `vscode.window.showQuickPick`/`showInputBox` sequence): full customize
  path writes the expected `Partial<HarnessConfig>`; "use global
  defaults" path writes nothing; cancelling mid-wizard writes nothing and
  still leaves the change created; an all-"(inherit)" customize pass
  writes nothing; no change id given does nothing at all.
- [x] 3.2 `openspec/specs/agentic-harness/spec.md` delta — new
  requirement for the combined flow (written before implementation,
  matches what was actually built).
- [x] 3.3 `openspec change validate --strict agentic-harness-change-template`
  — passes.
- [x] 3.4 typecheck/lint/test for `extension` — all green (165 tests).
- [x] 3.5 Version bump via `npx changeset` (`openspec-ui-vscode` only) —
  `.changeset/agentic-harness-change-template.md` added, not yet applied.

## 0. Gate

- [ ] 0.1 Do not begin implementation until the other agent currently
  working in this repository (`acp-agent-adapters`/
  `agentic-harness-git-stage`/`changeset-version-automation`, as of
  2026-08-31) has committed and stepped away — starting a `copilot` CLI
  `apply` run concurrently in the same working copy risks colliding with
  its uncommitted changes.

## 1. Command implementation

- [ ] 1.1 `packages/extension/src/commands.ts`: new
  `openspec-ui.setUpAgenticHarness` handler — runs
  `detectAvailableAgents()`; if nothing detected, shows a short message
  and skips straight to task 1.3.
- [ ] 1.2 If at least one agent is detected: asks (in order) "control
  agent" (`propose`/`review`/`archive`, offered only detected agents,
  current resolved value pre-selected), "apply agent" (`apply`, same
  constraints), "autonomy level" (`assisted`/`semi-autonomous` only — see
  design.md, "`autonomous` is not offered at all"). Each answer is
  written immediately via `writeGlobalHarnessConfig` (merging into
  whatever already exists on disk), not accumulated — see design.md,
  "Writes progressively, not once at the end". `undefined` from any
  `showQuickPick` (Esc) stops the wizard at that point without discarding
  earlier answers.
- [ ] 1.3 Asks "Generate CLAUDE.md/AGENTS.md now?" only if at least one is
  missing; if yes, reuses `openspec-ui.generateAgentInstructions`'s exact
  `listBootstrapProjectTypes()`/`writeAgentInstructions()` call.
- [ ] 1.4 `openspec-ui.initialize`'s existing handler: after a successful
  `initOpenSpec()`, if `openspec/agent-harness.json` does not exist yet,
  shows a dismissible `showInformationMessage` with an action button that
  invokes `openspec-ui.setUpAgenticHarness`. No change to `initialize`'s
  own return value or existing behavior otherwise.

## 2. VS Code integration

- [ ] 2.1 `packages/extension/package.json`: register
  `openspec-ui.setUpAgenticHarness` ("OpenSpec UI: Set Up Agentic
  Harness") — Command Palette only, no tree/menu contribution (this is a
  workspace-wide setup action, not tied to a specific tree item the way
  `createChangeTemplate`/`configureHarnessForChange` are).

## 3. Tests and verification

- [ ] 3.1 Unit tests (`commands.test.ts`, mocked `detectAvailableAgents`/
  `showQuickPick`/`writeGlobalHarnessConfig`): nothing-detected path
  skips straight to the CLAUDE.md/AGENTS.md question; each answered
  question is written immediately (assert `writeGlobalHarnessConfigMock`
  call count and arguments after each step, not just at the end);
  cancelling after the first question still leaves that first answer
  persisted; `autonomous` never appears in the QuickPick's option list;
  the post-`initialize` suggestion only appears when `agent-harness.json`
  does not already exist.
- [ ] 3.2 `openspec/specs/agentic-harness/spec.md` delta — new
  requirement for the guided first-run flow.
- [ ] 3.3 `openspec change validate --strict agentic-harness-init-wizard`.
- [ ] 3.4 typecheck/lint/test for `extension`.
- [ ] 3.5 Version bump via `npx changeset` (`openspec-ui-vscode` only).

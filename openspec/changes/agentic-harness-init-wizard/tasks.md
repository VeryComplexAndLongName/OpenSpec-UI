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
- [ ] 1.4 **Only if `acp-agent-adapters` has landed by the time this task
  is implemented** (see design.md, "Ordering against
  `acp-agent-adapters`" — otherwise skip this task entirely and file it
  as a fast-follow inside that change instead): if `claude-cli` was
  chosen for the control or apply role in task 1.2, read the version
  already captured by `detectAvailableAgentsDetailed()` (from
  `@openspec-ui/core`'s `agent-detection.ts`, added by
  `agent-usage-accounting`) for `claude-cli` — do **not** run `claude
  --version` a second time; that spawn is exactly what ADR 0017 decision
  6 rejects, since detection already pays for it. Compare the captured
  version (when present) against the tested-version constant exported by
  `acp-agent-adapters`'s `claude-cli-acp` module. On mismatch, show a
  dismissible `showWarningMessage` naming both versions and pointing at
  `docs/adr/0013-acp-agent-adapters.md`; does not block the wizard from
  continuing. When the captured version is absent (detection's probe
  produced no readable version, or `claude-cli` was not detected at all),
  skip the check silently — `detectAvailableAgentsDetailed()`'s own
  `detected` flag already covers presence; this step only adds version
  detail on top of it, and must not spawn anything itself to get one.
- [ ] 1.5 `openspec-ui.initialize`'s existing handler: after a successful
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
- [ ] 3.1b Only if task 1.4 was implemented (see design.md, "Ordering
  against `acp-agent-adapters`"): unit tests for the version check —
  matching versions show no warning, a mismatch shows the warning without
  blocking, a `claude --version` spawn failure skips the check silently,
  and the check never runs when `claude-cli` was not chosen for either
  role.
- [ ] 3.2 `openspec/specs/agentic-harness/spec.md` delta — new
  requirement for the guided first-run flow, plus the `claude-cli`
  version-compatibility requirement (only if task 1.4 was implemented —
  otherwise leave that requirement out of the delta for this change's own
  archive, and let whichever change implements task 1.4 as a fast-follow
  add it then).
- [ ] 3.3 `openspec change validate --strict agentic-harness-init-wizard`.
- [ ] 3.4 typecheck/lint/test for `extension`.
- [ ] 3.5 Version bump via `npx changeset` (`openspec-ui-vscode` only).

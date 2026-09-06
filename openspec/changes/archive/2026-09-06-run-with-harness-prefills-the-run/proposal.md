## Why

Right-clicking a change and choosing **Run with Agentic Harness** opens a
panel with nothing filled in: the command is `list`, no change is
selected, and the agent is the default one. The user has to re-enter what
they just told the product by right-clicking a specific change.

Everything needed is already there. `openspec-ui.runWithHarness` passes
the change through — `revealAiPanel({ ...dashboardContext(workspaceRoot,
item.changeDir), startChain })` — and `AiPanel` takes `changeDir` as a
prop. It simply starts from `useState<CommandKind>("list")` and
`useState<string>("")` and never consults it.

The agent is the same fact one step further on. `AiPanel` already
pre-selects the agent from `stepAgents`, keyed on the current command
kind through `COMMAND_KIND_TO_HARNESS_STAGE`. With the kind stuck at
`list` there is no stage, so no entry is looked up and the picker keeps
`DEFAULT_AGENT_ID`. **Fixing the command kind fixes the agent as a
consequence** — the configured agent was never unavailable, only
unreachable.

So this is one defect with three visible symptoms, and the fix is to use
what the host already sends rather than to send more.

## What Changes

- `packages/webui/src/components/AiPanel.tsx`: the selected change is
  seeded from `changeDir`, and the command kind can be seeded by the host
  that opened the panel.
- `packages/extension`: opening the panel through **Run with Agentic
  Harness** seeds `implement`. Opening it any other way keeps today's
  `list`, which is the right default when no change has been named.
- Nothing enforces any of it. A seeded value is a starting point the user
  can change, exactly as the `stepAgents` agent recommendation already is.

## Capabilities

### New Capabilities

(none — extends `agentic-harness`)

### Modified Capabilities

- `agentic-harness`: running a change from its own context menu starts
  from that change, that stage, and that stage's configured agent.

## Impact

- `packages/webui/src/components/AiPanel.tsx` and its test.
- `packages/extension/src/webview/ai-panel.ts`,
  `packages/extension/src/commands.ts`.
- No change to `resolveHarnessConfig`, to `stepAgents` resolution, or to
  what any run does once started.

## Explicitly out of scope

- The chain path. A change whose config resolves to `chain` opens
  `HarnessChainPanel`, which has one button and nothing to pre-select.
- Enforcing the configured agent. The picker stays a recommendation; see
  `agentic-harness`'s existing "Annotate, don't filter" decision.

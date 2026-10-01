## Why

Reported by a first-time user on 2026-09-30, from a change holding only
`.openspec.yaml` and notes from an exploration: "I press on start, and the
offered tasks are the same. The 'propose' is missing. And 'implement'
generates an error." And, of "Implement with the VS Code agent": "I don't
get Claude offered, but only Copilot."

Four things were behind it, each read from the code:

- **Propose wrote nothing.** The propose stage is the command kind `plan`,
  and its whole instruction was "Draft an implementation plan for the
  change described below, without changing code." For a change with no
  proposal the rest of the prompt is "(no artifact files found at this
  path)": notes such as `exploration.md` are not artifacts of the schema
  and are not read into it. The agent was given nothing to propose from and
  was not asked to write a proposal. `a-change-before-its-proposal` made
  Start on a Drafted card begin at propose, and checked that the dialog
  opened, not that the stage produced anything.
- **The single-stage picker opened on `implement`, whatever the change
  was.** `the-run-dialog-says-where-it-starts` made the dialog say "Starts
  at propose", and the panel behind "Run one stage" then opened on apply.
  The user's run was an agent declining to implement a change with no
  `tasks.md`.
- **The picker's names are not OpenSpec's.** It lists `plan`, `implement`
  and `review`, the protocol's command kinds. A person who knows
  `propose` and `apply` does not find them, and `verify` is not listed at
  all.
- **"Implement with the VS Code agent" does not say whose agent.** It
  hands the change to VS Code's own Chat, which offers its own models. It
  sits under a list of agents configured per stage and reads as one more
  of them.

## What Changes

- **Propose writes the change's planning artifacts.** The instruction for
  `plan` asks for the artifacts the change's schema wants and the change
  lacks, written into the change's directory, each following `openspec
  instructions <artifact>`, and validated strictly at the end. What else
  the directory holds is read as the description of the change. Where
  nothing says what the change is for, nothing is written and the reply
  says so. Code, and files outside the change, are left alone.
- **The picker opens on the stage the dialog named**, in both hosts:
  propose, apply or verify, from the same `runStartStage` the chain
  resumes with. `RUN_START_COMMAND` in core turns the stage into its
  command.
- **The picker shows OpenSpec's names.** `plan` reads "propose" and
  `implement` reads "apply"; the four stages are listed in the order a
  chain runs them, and `verify` is one of them. The command kinds on the
  wire are unchanged. A completion notification uses the same names.
- **The third path is "Apply in VS Code Chat"**, and its sentence says the
  model is the one chosen in that chat and that none of the configured
  agents runs.

Not in this change: `archive` in the picker. Archiving is not an agent's
stage; it has its own command and its place in the chain.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agentic-harness` - what the propose stage's instruction asks for, what
  the single-stage picker offers and opens on, and how the VS Code Chat
  path is named.

## Impact

- `packages/core/src/agents/shared.ts`: the `plan` instruction.
- `packages/core/src/run-plan.ts`: `RUN_START_COMMAND`, `commandLabel`,
  and the `vscode-agent` path's title and sentence; exported from
  `browser.ts`.
- `packages/webui`: `AGENT_COMMANDS` and the notification's wording in
  `notify-run-completion.ts`; `AiPanel.tsx` lists `verify`, shows the
  labels and follows a changed `initialCommandKind`; `extension-entry.tsx`
  and `standalone-entry.tsx` pass the stage the plan named.
- `packages/extension/src/run-notifications.ts`: the editor's own
  notification uses the same names, and covers `verify`.
- `packages/server/src/websocket.ts` and
  `packages/extension/src/webview/ai-panel.ts`: `verify` in the map from a
  command kind to its stage, so a stage set to `vscode-chat` is handled for
  it as for the other three.
- No command or event is added or changed: `verify` is already a command
  kind, and already what the chain sends.
- `HARNESS.md`, `README.md`, `packages/extension/README.md`.

# @openspec-ui/webui

Transport-neutral React components shared by the standalone browser application
and the VS Code Webview. Components communicate through `Transport`, implemented
by `FetchTransport` and `MessageBridgeTransport`; host-specific business behavior
remains outside this package.

The shared UI capability is governed under `openspec/changes/shared-ui/`.

## Modules

- `transport/`: transport contract, fetch/WebSocket delivery, and VS Code message bridge.
- `components/ChangesList`, `ArchiveList`, `ChangeDiff`, and `ChangeRelations`:
  change and archive presentation using core-derived state.
- `components/SpecsTree`, `RequirementView`, and `SpecsSearch`: read-only spec views.
- `components/TasksChecklist`: task progress and host-provided task execution callback.
- `components/AgentPicker` and `AiPanel`: command execution and event streaming.
- `ProcessesView`: persisted process details, rollback, and retention controls.

## Presentation Boundary

Changes, archive, specs, and tasks components receive prepared data through
props. The host decides whether data came from REST or a direct core import.
`AiPanel` directly requires `Transport` because command execution is inherently
an event stream.

## Agent Selection

`Command.agentId` tells the host which registered core adapter should execute a
command. The UI reads available agents from the shared core registry rather than
maintaining a separate list.

Markdown editing and diff presentation are delegated to native host facilities
where available, especially in VS Code.

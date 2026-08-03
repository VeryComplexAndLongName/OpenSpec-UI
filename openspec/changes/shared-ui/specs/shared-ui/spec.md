# shared-ui Specification

## Purpose
One React component set for Changes/Archive/Specs/Tasks/AI panel that works
consistently over any transport, reused as-is in both standalone browser and
VS Code extension Webview.

## ADDED Requirements

### Requirement: Components are transport-agnostic
The system SHALL interact with `execution-core` only via the `Transport`
interface and SHALL NOT perform direct `fetch` or `postMessage` calls inside
view components. The system SHALL behave identically regardless of the
transport implementation provided at initialization.

#### Scenario: Switch transport implementation without component changes
- **WHEN** the same component tree is initialized first with `FetchTransport`
  and then with `MessageBridgeTransport`
- **THEN** components render equivalent output for equivalent data without code
  changes in the component layer

### Requirement: Change status comes from derived state, not UI logic
The system SHALL display change status
(`draft`/`in-progress`/`implemented`/`archived`) using the value computed by
`execution-core` and SHALL NOT implement status calculation logic in `webui`.

#### Scenario: Heuristic changes in execution-core
- **WHEN** change-state derivation logic changes in `execution-core`
- **THEN** `webui` display updates automatically without view-layer logic
  changes

### Requirement: Markdown editing is delegated to host when available
The system SHALL render spec/proposal markdown in read-only mode inside its
views and SHALL delegate editing to native host editor where available (VS Code
native editor in extension mode).

#### Scenario: User edits spec in VS Code extension
- **WHEN** user initiates spec-file editing in VS Code extension context
- **THEN** system opens the file in native VS Code editor, not inside Webview

### Requirement: AI panel uses one protocol independent of selected agent
The system SHALL provide one command-launch interface
(`plan`/`implement`/`review`) and one event-stream rendering approach
independent of selected CLI agent.

#### Scenario: Selected agent changes
- **WHEN** user switches selected agent from one CLI to another
- **THEN** command form and event rendering stay the same; only the underlying
  `AgentRunner` adapter changes
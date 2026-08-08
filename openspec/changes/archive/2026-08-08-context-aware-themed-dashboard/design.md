# Context-Aware Themed Dashboard Design

## Context

The extension-host `openAiPanel` command calls a parameterless reveal method.
The webview entry therefore initializes path inputs only from local storage.
The shared shell CSS defines a fixed light palette for both standalone and the
extension webview.

## Goals / Non-Goals

### Goals

- Prefer current VS Code workspace/change context over stale stored paths.
- Update an already-open dashboard when it is revealed with new context.
- Follow light, dark, high-contrast, and custom VS Code color themes.
- Preserve standalone visual styling.

### Non-Goals

- Add multi-root workspace selection.
- Redesign the dashboard layout.
- Theme the optional cross-origin localhost iframe from the extension host.
- Change the command/event protocol.

## Decisions

### Host-provided dashboard context

`AiPanel.reveal` accepts workspace and change-directory context. Initial
context is encoded as escaped `data-*` attributes on the webview root. Later
reveals send a typed webview message. The extension entry treats host context
as authoritative and persists it for subsequent manual use.

Rejected alternative: rely on local storage. It preserves stale values across
repositories and cannot represent the currently selected change.

### Changes-view default

The Changes view title action has no selected tree item. It supplies the active
workspace root and `<root>/openspec/changes`, which is the directory expected
by the dashboard's internal change selector. A command invocation with a change
item supplies that exact change directory.

Rejected alternative: arbitrarily choose the first active change. Ordering does
not communicate user intent and can target the wrong change.

### Extension-only VS Code theme layer

The extension entry appends an override stylesheet based on standard
`--vscode-*` variables. It maps existing semantic shell tokens rather than
forking components. Standalone continues using the existing palette.

Rejected alternative: replace the shared base palette globally. That would
change standalone appearance and couple browser rendering to unavailable VS
Code variables.

## Risks / Trade-offs

- The optional localhost iframe is cross-origin and cannot inherit webview CSS
  variables; it retains standalone styling. The default message-bridge mode is
  fully themed.
- Custom themes can define unusual color combinations. Using VS Code semantic
  tokens preserves the same accessibility intent as native controls.

## Protocol Compatibility

The core command/event protocol is unchanged. Context messages exist only
between the extension host and its webview bootstrap.

## Verification

- Workspace-wide typecheck and lint passed.
- All 248 unit and contract tests passed: core 103, extension 49, server 18,
  and webui 78.
- Focused tests verify host context precedence, storage fallback, typed update
  messages, HTML attribute escaping, repeated reveal updates, and separation of
  standalone and VS Code theme CSS.
- The extension passed all six scenarios in a real VS Code 1.132 Extension
  Development Host, including direct assertions for dashboard workspace and
  change-directory context.
- The production extension, webview, and standalone bundles built successfully.

## Remaining Risks

- Automated checks verify semantic VS Code theme tokens and a real webview
  launch, but do not perform pixel-level comparison across every third-party
  theme.
- The optional localhost iframe retains standalone styling because browser
  cross-origin isolation prevents inheriting VS Code CSS variables.

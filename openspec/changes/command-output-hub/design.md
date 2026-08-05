## Context

This change builds on the existing command/event protocol in `execution-core`
and keeps `server`/`extension` as thin adapters. It does not add new protocol
kinds; instead, it improves presentation and command entry points at the UI
layer.

## Goals / Non-Goals

**Goals:**
- Make command output readable and structured in the AI panel.
- Reuse existing typed OpenSpec wrappers (`list/show/validate`) for extension
  utility actions.
- Add `openspec view` entry point in extension for users who need the native
  interactive CLI dashboard.

**Non-Goals:**
- No change to command/event protocol kinds in `packages/core`.
- No replacement of native `openspec view` UX inside Webview.
- No architecture changes to transport model or security model.

## Decisions

- **Structured event rendering in AI panel:**
  detect and render common payload shapes (JSON, checklists, key-value blocks,
  bullet lists) with dedicated UI blocks instead of one plain text line.
- **Chunk coalescing before render:**
  merge adjacent fragmented stdout/stderr/progress chunks so transport-level
  fragmentation does not leak into user-visible text.
- **Run analysis summary:**
  compute a lightweight run-level summary (steps, warnings, terminal result)
  that complements chronological event log.
- **Include `status` in AI panel picker:**
  keeps one command-launch surface for all protocol commands users expect to
  run directly from UI.
- **Extension utility commands as parsed UI actions:**
  `show`/`validate` use typed wrappers from `@openspec-ui/core` and render
  Markdown documents for readability.
- **`openspec view` via terminal handoff:**
  command launches integrated terminal with `openspec view` instead of trying
  to reimplement the interactive CLI inside Webview.
- **Parsed `openspec view` companion summaries:**
  provide table-based summaries from typed wrappers (`listChanges`/`listSpecs`)
  in both extension (markdown document) and standalone (REST-backed panel).

Rejected alternatives:
- Reimplement full `openspec view` in custom Webview UI.
  Rejected because it duplicates the upstream interactive dashboard and
  increases maintenance cost.
- Add new protocol command kinds for utility actions.
  Rejected because existing typed wrappers and command palette flows are
  sufficient and avoid protocol churn.

## Risks / Trade-offs

- Parsing heuristics may occasionally classify mixed text as plain output.
  Trade-off accepted: fallback remains readable plain text.
- Additional extension commands increase command palette surface area.
  Mitigation: command naming stays explicit and OpenSpec-scoped.

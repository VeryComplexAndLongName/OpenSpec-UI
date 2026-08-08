# 0003: Native VS Code OpenSpec Workbench

Status: Accepted

Date: 2026-08-08

## Context

ADR 0002 made direct OpenSpec JSON commands the only user-facing execution
path because external agent CLIs were unreliable. That decision improved
determinism, but it also left the extension as a read-oriented utility: change
artifacts are not navigable as a hierarchy, lifecycle actions are absent, and
users cannot initiate an implementation workflow through the AI capabilities
already hosted by VS Code.

The workbench must preserve deterministic OpenSpec operations while giving the
user explicit control over AI-assisted mutations, concurrent processes, and
rollback.

## Decision

1. Direct OpenSpec CLI operations remain the source of truth for deterministic
   lifecycle commands such as create, status, validate, and archive.
2. AI-assisted plan, implement, and review workflows use native VS Code Chat
   integration. The extension registers an OpenSpec chat participant and typed
   Workbench commands;
   it does not silently invoke the built-in coding agent or an external CLI.
3. The extension uses native tree views and markdown editors for repository
   artifacts. A Webview is reserved for process visualization and controls that
   have no equivalent native VS Code surface.
4. Mutating runs are scheduled by change. At most one mutating run may operate
   on a change, while different changes and read-only operations may run in
   parallel.
5. Every mutating run creates a scoped checkpoint before execution. Rollback
   restores only files changed by that run after presenting a diff and requiring
   explicit confirmation. Existing user changes that predate the run are never
   discarded.
6. Shared lifecycle, scheduling, checkpoint, and process-state logic belongs in
   `packages/core`. The extension and server remain host adapters.

## Rejected Alternatives

### Restore external agent CLIs as the default execution path

Rejected because it reintroduces the reliability and environment problems that
led to ADR 0002. External adapters may remain available for compatibility, but
they are not the default Workbench UX.

### Invoke the built-in VS Code coding agent programmatically

Rejected because VS Code does not expose the built-in agent as a general
extension execution API. A chat participant and language-model tools provide a
supported, consent-based integration boundary.

### Use Git reset for rollback

Rejected because repository-wide reset can destroy unrelated user work. A
run-scoped checkpoint has a smaller and auditable blast radius.

### Put the complete workbench in one Webview

Rejected because markdown editing, diffing, file watching, and source control
already have stronger native VS Code implementations.

## Consequences

- AI workflows require a VS Code installation with compatible Chat and language
  model APIs and an available model. Deterministic OpenSpec workflows continue
  to work without AI.
- A checkpoint store and run scheduler add core complexity, but make concurrent
  work and rollback explicit and testable.
- Standalone mode can reuse core lifecycle and process APIs, while native Chat
  remains an extension-specific adapter.
- ADR 0002 remains valid for command-panel execution; this ADR narrows its
  prohibition by adding a separate, explicit native Chat workflow.

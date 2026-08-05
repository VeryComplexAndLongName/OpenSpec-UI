# ADR 0002: Direct OpenSpec mode for user command execution

Status: Accepted

Date: 2026-08-05

## Context

The original product flow exposed user-facing command execution via external AI
agent CLIs. In real usage, these agent paths were often unreliable,
environment-dependent, or slow, producing poor UX in both delivery targets.

At the same time, OpenSpec native JSON commands provide deterministic,
non-interactive outputs for key workflows (`status`, `list`, `show`,
`validate`) and are sufficient for the current product scope.

The repository governance requires architecture-impacting behavior changes to be
documented with ADRs and linked from the corresponding OpenSpec change.

## Decision

Adopt direct OpenSpec mode as the default and only user-facing execution model
for command-panel workflows:

- Remove user-facing AI-agent execution actions (`plan`, `implement`, `review`,
  `cancel`) from extension command surfaces and panel workflows.
- Route user-facing command execution through OpenSpec JSON commands only for
  `status`, `list`, `show`, and `validate`.
- Keep server and extension behavior deterministic by avoiding default AI runner
  bootstrap in runtime paths.
- Preserve optional test-time injection points for runner mocks where needed by
  automated tests.

## Rejected alternatives

### Keep hybrid mode (agents + direct OpenSpec) as first-class UX

Rejected because the agent path is the least deterministic and creates repeated
support overhead in constrained environments.

### Keep agent commands but hide behind advanced settings

Rejected because hidden controls still preserve ambiguous execution semantics,
increasing maintenance burden and user confusion.

### Revert to agent-first flow and keep direct OpenSpec as fallback

Rejected because fallback-only direct mode still leaves default behavior tied to
the least reliable path.

## Consequences

- User-facing workflows become more predictable and faster.
- Product scope is narrowed to OpenSpec-native operations in the panel.
- AI-agent adapters may remain in code for compatibility/tests, but are no
  longer part of the primary UX contract.
- Related OpenSpec change: `openspec/changes/direct-openspec-mode/`.

# 0001: Shared Core Monorepo with Two Delivery Targets

Status: Accepted

Date: 2026-08-03

## Context

OpenSpec UI must ship as both a standalone browser application with a local
server and a VS Code extension. Both targets visualize the same OpenSpec and Git
data and execute the same workflows. Duplicating behavior would cause the two
deliveries to diverge over time.

The delivery model was reviewed independently after the initial architecture
proposal. That review changed the extension transport recommendation while
preserving a shared behavioral core.

## Decision

1. **Use a layered monorepo.** `packages/core` owns all business behavior,
   including execution, OpenSpec and Git integration, security, persistence,
   and derived change state. `packages/webui` owns transport-neutral React
   components. `packages/server` and `packages/extension` are thin host adapters.
2. **Use direct core imports and a message bridge as the extension default.**
   The extension host already runs Node.js and does not need HTTP for normal
   operation. An optional local server remains available when standalone UI
   parity is more important than localhost lifecycle simplicity.
3. **Define the command and event protocol only in core.** Commands are `plan`,
   `implement`, `review`, `status`, and `cancel`. Events are `started`, `stdout`,
   `stderr`, `progress`, `completed`, `failed`, and `cancelled`. Host adapters
   serialize this protocol; they do not reimplement execution.
4. **Keep the agent security model in core.** Repository file content is data,
   never executable UI instructions. Every run is restricted to the workspace,
   commands and arguments are allowlisted, and executions are audited.
5. **Derive change state in core.** Draft, in-progress, implemented, and archived
   states are inferred from location and `tasks.md`; they are not stored in a
   custom OpenSpec field.
6. **Prefer native VS Code UI.** The extension uses native diff, tree, Git,
   terminal/task, configuration, and Chat APIs where they fit the workflow.

## Rejected Alternatives

### Always run the standalone server inside the extension

Rejected because dynamic ports, window collisions, authentication, and process
cleanup would burden the most common extension workflow. The message bridge is
the default; the local server remains optional.

### Implement agent execution independently in each host

Rejected because streaming, cancellation, errors, and security behavior would
diverge. Both hosts must adapt the same core protocol.

### Store change state in `.openspec.yaml`

Rejected because it would extend an external format. A documented core heuristic
provides status without forking OpenSpec.

## Consequences

- Behavioral defects are fixed in core, which remains independent of HTTP and
  VS Code APIs.
- Web UI components depend on a transport interface with fetch and message-bridge
  implementations.
- Host UX may differ, but shared behavior and protocol contracts remain testable.
- Security is part of the initial execution architecture rather than a later add-on.

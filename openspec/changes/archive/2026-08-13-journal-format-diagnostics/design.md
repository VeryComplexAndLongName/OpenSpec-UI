## Context

The journal contains recovery and rollback state shared by delivery targets.
Compatibility errors must be machine-readable while retaining safe default
behavior for callers that only display `Error.message`.

## Decisions

- Export `WorkbenchJournalLoadError` from core with stable diagnostic codes.
- Include the journal path on every load diagnostic.
- Include discovered and supported versions for format compatibility failures.
- Validate journal and checkpoint version discriminators before deserialization.
- Preserve the existing missing-file behavior: a missing journal is an empty journal.
- Do not mutate the journal in any load failure path.

## Trade-offs

- Recovery remains disabled for unknown versions rather than attempting partial reads.
- Structured diagnostics add a public core type that must remain backward compatible.

## Architecture

ADR 0006 defines the fail-closed and no-rewrite policy.
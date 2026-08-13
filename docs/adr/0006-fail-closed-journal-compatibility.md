# 0006: Fail-Closed Journal Compatibility

Status: Accepted

Date: 2026-08-08

## Context

ADR 0004 introduced a versioned run journal and serialized checkpoints. A
workspace can be opened by standalone and VS Code deliveries with different
bundled core versions. An older delivery may therefore encounter a newer
journal or checkpoint format that it cannot safely interpret.

A generic load error preserves data but does not distinguish corruption from
an upgrade requirement. Moving an unsupported journal aside would let the
older delivery create a fresh journal at the original path, splitting process
history and making later recovery ambiguous.

## Decision

1. Unknown journal and checkpoint versions fail closed before recovery state is used.
2. Compatibility failures never rename, rewrite, quarantine, or delete the persisted journal.
3. Core exposes structured load diagnostics with a stable code, journal path,
   discovered version, and supported version where applicable.
4. Human-readable diagnostics state whether the user should upgrade the delivery
   or inspect a corrupted journal. Hosts may adapt presentation but do not infer
   compatibility from error-message text.
5. A future schema change must add an explicit migration path before core writes
   a newer version. Migration must be covered by fixtures for every supported
   source version and preserve the last valid source until replacement succeeds.

## Rejected Alternatives

### Rename future journals to a quarantine path

Rejected because the older host could then create a new journal and split the
workspace's process history across two files.

### Best-effort parsing of unknown versions

Rejected because recovery and rollback are destructive capabilities. Missing or
reinterpreted fields must not silently change their behavior.

### Treat every load error as corruption

Rejected because a valid future version requires an upgrade, not repair or deletion.

## Consequences

- Older deliveries preserve future journal data and provide actionable diagnostics.
- Recovery remains unavailable until a compatible delivery is used.
- Schema evolution requires deliberate migrations instead of permissive parsing.
- Hosts can test and render compatibility failures without matching message text.
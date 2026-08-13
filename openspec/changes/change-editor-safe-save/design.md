## Context

Change markdown remains the source of truth and may be edited by the UI, an
external editor, or OpenSpec tooling. Direct parallel writes do not provide a
coherent failure boundary and provide no lost-update protection.

## Decisions

- A core `ChangeEditorStore` owns path resolution, reads, revision generation,
  and multi-file replacement.
- Revisions are deterministic hashes of all editable paths and contents.
- Save requires the revision returned by read. A mismatch raises a typed
  conflict before any file is modified.
- Save stages every new file beside its destination, moves existing files to
  transaction-specific backups, and replaces destinations. On failure it
  restores the original set before reporting the error.
- The REST adapter maps revision conflicts to HTTP 409 and other storage
  failures to HTTP 500.
- The UI keeps unsaved text on conflict and asks the user to reload before
  retrying.

## Trade-offs

- Filesystem rename cannot provide a cross-directory atomic visibility point,
  but staging and rollback prevent a reported failure from intentionally
  leaving a mixed document state.
- Revision checks use content hashing, adding small read and hash costs for
  four markdown files.

## Architecture

This follows ADR 0001: storage behavior lives in `packages/core`; server and
web UI remain adapters. No architecture decision changes.
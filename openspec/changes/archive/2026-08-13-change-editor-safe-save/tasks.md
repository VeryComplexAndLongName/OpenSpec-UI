## 1. Core Storage

- [x] 1.1 Add Change Editor document reads with deterministic revisions.
- [x] 1.2 Add conflict-aware staged save with rollback on replacement failure.
- [x] 1.3 Test successful saves, stale revisions, and injected mid-save failure.

## 2. Standalone Adapter and UI

- [x] 2.1 Route Change Editor read/save endpoints through core storage.
- [x] 2.2 Return HTTP 409 for stale revisions and preserve local UI edits.
- [x] 2.3 Add server and web UI regression tests.

## 3. Delivery and Verification

- [x] 3.1 Bump affected package minor versions and update release documentation.
- [x] 3.2 Run focused tests, workspace verify/build, and strict OpenSpec validation.
- [x] 3.3 Run a live stale-edit and successful-save smoke test.
## 1. Implementation

- [x] 1.1 Extract the shared overlap analysis and reuse it from Archive Preview.
- [x] 1.2 Expose Show Spec Overlaps on active Pipeline cards in both hosts.

## 2. Verification

- [x] 2.1 Run the scoped Core archive-preview and Web UI Pipeline action tests, then typecheck the affected hosts.
- [x] 2.2 Run strict OpenSpec change validation and add the user-facing changeset.

Verified the Git fixture with the real archive CLI (1 test), the Pipeline actions with the Web UI Vitest configuration (6 tests), scoped ESLint, changesets and Core, Web UI, server and extension typechecks.

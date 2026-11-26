## Context

JUnit results and scenario check mappings already have separate contracts.
This change adds an editor for the existing testcase mapping.

## Non-Goals

Automatic CI artifact retrieval, removing associations, and proving semantic
coverage are outside this MVP.

## Decisions

- Reuse the mapping preview and guarded write transaction with a separate JUnit
  request. A combined check/test identity was rejected because a check name
  cannot represent a JUnit classname/name pair.
- List only unique testcase identities from one saved report and bind the
  preview to its identity, the displayed head, and the mapping bytes. Guessing
  from test titles or treating duplicate outcomes as interchangeable was rejected.
- Save a local edit through the selected change worktree. Automatic commit or
  push was rejected because the mapping deserves normal review.
- Add an optional PR Review operation and response fields. Existing requests,
  execution commands and events keep their contracts.

## Risks / Trade-offs

An older report may supply a testcase name. Its result remains historical.
An imported report replaced during editing requires a fresh selection.

## Verification

Gitea Quality run 8605 passed on implementation head 358927475fc5cfe6807c619e247e114bf540a834. The authenticated HTTP contract in packages/server/src/change-actions-rest.test.ts passed, including the save guard. The browser contract in packages/server/e2e/junit-review.spec.ts passed on a real local server. The VS Code JUnit adapter passed native confirmation and cancellation tests. See the scoped commands and outcomes in tasks.md. Historical report attribution remains qualified and remote artifact import is tracked separately.

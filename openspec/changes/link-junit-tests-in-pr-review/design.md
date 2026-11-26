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

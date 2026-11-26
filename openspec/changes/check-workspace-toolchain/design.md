## Context

Diagnose Workspace already observes OpenSpec through a bounded version probe.
Project instructions can be compared without executing their contents.

## Non-Goals

Installing tools, upgrading generated instructions, and enforcing an agent
run gate are outside this MVP.

## Decisions

- Reuse the existing version probe and parse precise OpenSpec versions there.
  Running a separate executable supplied by the project was rejected.
- Use optional exact version and SHA256 declarations in a Workbench-owned
  file. Extending the upstream OpenSpec config would couple this feature to
  another tool's schema.
- Normalize CRLF line endings before hashing instruction text. Hashing raw
  bytes would mark ordinary Windows checkouts as incompatible.

## Risks / Trade-offs

A fingerprint identifies the reviewed text. The project must update it when
accepting new instructions. Unsupported output or unreadable files are
reported as unavailable.

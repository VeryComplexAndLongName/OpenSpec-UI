# 0056: PR Review compares a pinned revision

Status: Accepted

Date: 2026-11-14

## Decision

Core prepares a read-only report from Git, the existing forge readers and local audit records. Both hosts open the report through the same named Pipeline action under [ADR 0044](0044-a-change-is-acted-on-from-its-card.md). Each host handles its own clipboard. The standalone action adds a report variant and the extension imports Core directly under [ADR 0001](0001-shared-core-two-delivery-targets.md).

Record an optional commit ID with new mechanical-check audit entries when the committed tree can be identified across the execution window. A report qualifies results against the reviewed commit. Legacy entries still identify the result and run.

## Alternatives

- Compare the checkout's working tree or treat its default branch as the PR base. Either choice can show changes outside the open PR.
- Use task state or a verify agent's conclusion as proof of a checked commit. Neither carries that provenance.
- Run or publish from the report. This would make opening or copying a report dependent on permission to change state.

## Context
A powered-off Homepage cannot consume timers. On recovery, due dates must use <= now, and existing receipts must take priority over writes. LinkedIn lacks the personal-history read permissions needed to reconcile an uncertain create automatically. Publication-center finite attempts remain intentional.

## Decisions
- Publish an accumulated public release-history.json alongside releases.json and publications.json, preserving prior version/date records. Homepage polls only published contracts and keeps its persisted snapshot; it does not read product source internals. Missing history from an older producer is tolerated, malformed history fails visibly and never deletes stored rows.
- Preserve all release candidates up to an explicit 1000-entry safety bound; refuse overflow instead of silently truncating. Homepage uses a matching count and byte bound. Rejected: silently retaining only the newest hundred, which loses undiscovered work during a long outage.
- Check npm latest immediately before a write. Older versions use a version-specific recovery tag; newer versions retain latest. Rejected: relying only on queue ordering, since an older retry can finish after a newer job. CircleCI serialization remains in place.
- Test overdue articles, editorial holds/future dates, interrupted leases, accepted-but-unrecorded results and repeated recovery against isolated databases and fake platforms. Never publish a test post or registry version. Rejected: clearing receipts or resetting all budgets, which can duplicate publications and hides genuine failures.

## Non-Goals
Restore the server or database, bypass expired credentials/finite retries, infer uncertain LinkedIn outcomes, alter editorial dates/holds, or publish test content.

## Risks / Trade-offs
The offline production database and installed timer state cannot be audited until server access returns. Persistent rows must survive recovery; restoring an older database backup can lose confirmations. LinkedIn uncertain creates and exhausted attempts still require operator reconciliation. The first rollout must preserve the existing database and credential files. No migration or new required environment variable is needed. No command/event or webui/server contract changes; those contract suites are not affected.

## Verification

Full verification: required Gitea PR Quality run 7560 passed on implementation head 5031aa1a01674eadffd9327ce500544b71e17773 before merge. CI logs explicitly show packages/server/src/scheduled-runs-contract.test.ts (4 tests) and packages/webui/src/transport/contract.test.ts (8 tests) passed; no command/event or host protocol was changed. Scoped Node publication tests passed 23/23. The offline production database and installed timer state remain unaudited, and server rollout awaits recovery; no real test publication was performed.

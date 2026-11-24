## Implementation
- [x] scripts/mirror-tested-release.mjs: accumulate immutable published version history and refuse candidate overflow rather than truncate.
- [x] scripts/publication-worker.mjs: select a recovery npm tag for a late older version without changing latest.
- [x] scripts/mirror-tested-release.test.mjs: verify retained histories, repeated generation and candidate overflow with node --test on this file only.
- [x] scripts/publication-worker.test.mjs: verify old-version tags and existing-version reconciliation with node --test on this file only.
- [x] deploy/publication/README.md: document catch-up, receipt retention and finite/manual recovery limits.

## Verification
- [x] Run the two named Node test files with the pinned Node runtime and record actual results; full verification is performed by required Gitea CI.

Completion operations: review, fetch current main immediately before every merge, complete required Gitea checks, archive through the normal project workflow and merge the archive, remove only clean merged task worktrees. Server rollout remains deferred while the host is unreachable.

Local evidence: node v24.21.0; node --test scripts/mirror-tested-release.test.mjs scripts/publication-worker.test.mjs: 23 passed; node --check for both changed .mjs sources: passed. Read-only merge of the actual published archive and manifest retained 397 prior entries and produced 400 unique dated public records. No registry writes. Full Gitea verification is pending.

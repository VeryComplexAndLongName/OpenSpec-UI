## Implementation and targeted verification

- [x] In scripts/publication-manifest.mjs, entry hashes one stable release asset and refuses missing or draft artifacts; publication-worker.test.mjs contract test passes.
- [x] In scripts/release-cli.mjs, reuse published npm bytes at cutover without registry writes. `node scripts/release-cli.mjs --dry-run` prepared CLI 0.33.0 from 5f818e4ab6c35b65db141cb1b18033e0a36a5673 with SHA-256 7028155c6cdd92b6533cd3ba1fbc86ac9b6ef34eb4f2c595f698b974d07d3287 and no tag/release write.
- [x] In .github/workflows/quality.yml, prepare release-cli and publish publications.json atomically beside releases.json; YAML parsing and release-notes.test.mjs pass. Do not add registry writes to Quality.
- [x] In scripts/publication-worker.mjs, carry the signed identity through claim -> validated immutable URL/hash -> remote reconciliation -> OIDC write -> finish confirmation; focused worker tests verify each junction, failed writes and lost successful replies. Do not rebuild approved packages.
- [x] In .github/workflows/publish.yml, bind short automatic main-only jobs to npm/marketplace environments and per-job OIDC; `node scripts/check-publish-workflow.mjs` passes.
- [x] In scripts/check-publish-workflow.mjs, reject extra triggers, missing guards, unscoped credentials and independent publishing paths; the policy mutation tests pass.
- [x] In scripts/check-publish-workflow.test.mjs, verify rejection of each broken workflow invariant; `node --test scripts/check-publish-workflow.test.mjs` passes.
- [x] In scripts/publication-worker.test.mjs, exercise approved bytes, checksum refusal, existing versions, failed writes, empty queues and identity probes; named Node tests pass.
- [x] In package.json, include publication-worker.test.mjs in the existing publish-workflow test gate; the exact named test files pass locally.
- [x] In docs/adr/0058-homepage-publication-center.md, record automatic approval, native OIDC and rejected persistent-token alternatives; source-language and text checks pass for this file.
- [x] In docs/adr/0048-npm-is-published-by-trusted-publishing-from-the-dispatch.md, point to the superseding ADR 0058; scoped source checks pass.
- [x] In .changeset/README.md, describe automatic artifact publication through Homepage and preserve the package-specific versioning process; scoped source checks pass.
- [x] In proposal.md, record that this release infrastructure change does not alter public delivery behavior and therefore needs no package changeset; no previously released artifact is rebuilt.
- [x] In this change's specification deltas, replace the manual-only release-quality requirements and define the publication-center contract; `openspec validate publication-center --strict` passes.
- [x] Run `node --test scripts/check-publish-workflow.test.mjs scripts/publication-worker.test.mjs scripts/release-notes.test.mjs`: 27 tests passed. Full product verification is reserved for PR CI.

## Required delivery follow-through

PR checks/review, merge, paired Homepage deployment, real OIDC token exchanges,
platform confirmations and archival remain required. Record their actual run
URLs in evidence.md after they happen. Do not archive based only on local tests.
The worktree is removed only after all commits, including archival, are in remote main.

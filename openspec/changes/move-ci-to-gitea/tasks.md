# Tasks

## 0. Access and preservation

- [x] 0.1 In publication-preflight.md, record actual CircleCI Free runs #1/#2,
  exact project/pipeline/context identity and successful npm token exchange
  without a card or package write. The npm trust is Valid; preserve GitHub trust.
- [x] 0.2 In scripts/check-marketplace-entra-access.mjs, verify certificate,
  actual profile, direct Contributor and unchanged publisher/extension ids.
  Five named tests and scoped ESLint passed. Actual certificate/native vsce
  probes passed locally and on the isolated production server without a write.
- [x] 0.4 In publication-preflight.md, record closed GitLab MR !1 and the
  owner-approved removal of its unused npm trust and Entra federation after
  replacement exchange succeeded. Preserve the working Entra certificate.

## 1. Preservation and authority

- [x] 1.1 In docs/migration/gitea.md, retain ref/tag/release/PR inventory and
  recoverable backups. The complete product bundle restored and passed fsck;
  production SQLite integrity and private code/service archive were verified.
  Preserve PR #1009 and the original dirty Homepage checkout, including raw diff.
- [x] 1.2 Integrate the prepared Publication Center in this owned worktree;
  reconcile provider choices through ADR 0059 and the publication-center delta.
  Do not edit its original worktree or create another queue.
- [x] 1.3 Accept docs/adr/0059-gitea-ci-and-independent-publication.md after
  real Gitea full run 6734, hosted CircleCI exchange and server Entra probes.
  Preserve both mirrors' current visibility and all existing public identities.

## 2. Gitea checks and proposals

- [x] 2.1 In .gitea/workflows/quality.yml, preserve complete quality, audit,
  dependency review, OpenSpec, native, browser/accessibility and version-PR
  gates. Bootstrap PR 1 passed full run 6734 and merged as ef91b62a. Its
  standard OpenSpec archive is prepared separately after that merge.
- [x] 2.1a In .gitea/runner/config.yaml and compose.yaml, enable authenticated
  per-repository cache only on private 192.168.137.34:8095, retaining job CPU,
  memory, privilege and socket boundaries. Selected gitea-ci tests/ESLint passed;
  an unauthenticated request returned 401 and native job 8958 saved the cache.
- [x] 2.2 In scripts/gitea-proposal.mjs, propose package versions and refreshed
  lockfile together, using an explicit lease on only changeset-release/main.
  Its named test refuses application-source or workflow edits. Do not auto-merge.
- [x] 2.3 In .gitea/workflows/dependencies.yml, propose compatible lockfile
  updates through the same scoped helper. Its named test refuses manifest
  changes and changes to the committed VS Code type baseline. Deliberate pins
  and majors remain review.
- [x] 2.4 Record the exact required checks/protection and actual Gitea delivery
  of preserved GitHub PR #1009 through Gitea PR 2. Merge only its passing head.
- [x] 2.5 In .gitea/workflows/version.yml, use the restricted maintenance
  account for checkout/push and PR API so proposal events trigger actual CI.
  Its grants were verified as write/non-admin on exactly these two repositories;
  the selected proposal/policy tests and strict OpenSpec passed. Record the
  actual automatic PR check run during post-merge acceptance.
- [x] 2.6 In .gitea/workflows/dependencies.yml, use that same restricted
  maintenance identity only for reviewed proposals. The policy refuses this
  credential in registry executors and unrelated Gitea jobs.
- [x] 2.7 In scripts/gitea-proposal.mjs, name eligible dependencies explicitly
  while leaving VS Code types for deliberate upgrades. Preserve manifest ranges
  and verify the actual workspace compiler baseline against the committed lock.
  Three named proposal cases and a real isolated npm 10.9.0 refresh passed;
  require a real dependency proposal run after full Gitea checks and merge.

## 3. Approved bytes and independent executors

- [x] 3.0 In packages/cli/scripts/smoke-package.mjs, accept the exact prepared
  archive and verify installed package identity. Its changed-file ESLint and
  syntax checks passed. Before completion, require the actual Gitea prepared
  tarball smoke and both v4 REST artifacts, including the native VSIX.
- [x] 3.0a In scripts/publication-receipt.mjs, bind artifact approval and each
  fixed worker-source file to successful actual main Quality metadata. Named
  receipt/worker/mirror tests pass and refuse changed source, purpose or bytes.
- [x] 3.1 In scripts/mirror-tested-release.mjs, preserve immutable tags/assets,
  recover original staged receipts/bytes and append manifest history. Seven
  named mirror tests cover conflicts, source allowlists and producer checkpoint
  refusal. Repeated schedules must not inflate GitHub self-download counters.
- [x] 3.2 In .circleci/config.yml, configure a main-only publication worker
  using the approved context, pinned isolated npm client and serial group.
  Policy tests refuse rebuilds, permanent tokens and another channel writer.
  Main context/trigger activation and the first real release remain acceptance.
- [x] 3.3 In deploy/publication/marketplace.service and marketplace.timer,
  define a bounded isolated certificate executor consuming Homepage leases.
  Its account/tools/private certificate are provisioned and server identity,
  Contributor and native vsce probes passed. Keep Flask unable to read the PEM.
  Runtime deployment, API probe and timer activation remain required acceptance.
- [x] 3.4 In scripts/check-publish-workflow.mjs, enforce independent executors,
  exact main/context, serialization, no persistent-token fallback, no rebuild
  and no Gitea/GitHub registry writer. Nine named mutation tests passed.
- [x] 3.5 Prepare removal of all GitHub workflows/Dependabot configuration;
  the policy refuses active GitHub YAML. Actual repository Actions disablement
  and mirror cutover occur only after replacement CI and credentials work.
- [x] 3.6 In scripts/publication-transport.mjs, decode single-line App key
  material only inside Node. The named JWT fixture test verifies its actual
  RSA signature, exact one-repository grant and refusal before any network call.
- [x] 3.7 In scripts/mirror-tested-release.mjs, decode the single-line signing
  key only at signing. The named receipt/mirror/policy tests and changed-file
  ESLint passed. The policy refuses raw PEM environment property names.

- [ ] 3.8 In .circleci/config.yml, export the probe parameter explicitly inside
  the shell command. In scripts/publication-worker.mjs, refuse ambiguous probe
  values before claiming a job. Verify named worker/policy tests, scoped ESLint
  and the actual hosted main probe after full Gitea CI and mirror delivery.

## 4. Selected local verification

- [x] 4.1 Record exact selected files and results in evidence.md. Only named
  Node tests, changed-file ESLint, YAML/shell parsing and strict OpenSpec ran
  locally. Application TypeScript did not change; no local full suite ran.
- [x] 4.2 Validate move-ci-to-gitea strictly and review source/target, signature,
  package, history and credential boundaries before the PR. Full required CI
  remains an explicit merge prerequisite, recorded separately after it runs.
- [x] 4.4 Preserve existing authored delivery notes and pending Changesets.
  This migration changes CI/deployment helpers, not delivered product behavior,
  and requires no invented package bump or disposable registry version.

## Required post-merge acceptance and cleanup

These ordered delivery actions are not pre-merge implementation checkboxes.
They remain mandatory and block final archival until their real evidence exists:

1. Record the migration PR's full Gitea checks/review and merge. Configure the
   scoped mirror App and final main-only CircleCI context/checkout/config refs.
   Disable actual GitHub Actions, bootstrap the checked fast-forward mirror and
   retain main/tag protections. Preserve existing GitHub source and release URLs.
2. Deploy the checked Homepage revision with the signed worker-source contract.
   Confirm its real API, unchanged historical records, installed public ids,
   loss-of-notification recovery, finite retries and duplicate refusal.
3. Probe both real executors without claiming work; then enable their recovery
   schedules and observe the first automatic successful runs. For the first
   legitimate version release, retain exact source/asset hashes and independently
   verify Marketplace, npm latest and the versions visible on openspec-ui.dev.
   Never create a disposable version or social test post.
4. Archive Publication Center first, then this migration, with standard OpenSpec
   so modified specs have their accepted base. Land synchronized specs/archive
   in authoritative main, pass required checks and mirror accepted main.
5. Verify every needed commit is in remote main and owned worktrees contain no
   needed unsaved/untracked or other-agent work. Detach only owned dependency
   junctions, remove owned worktrees with normal git worktree remove and delete
   merged local branches. Keep original user/peer worktrees and private backups.

Record actual outcomes and any remaining acceptance in evidence.md; do not claim
completion from the access probes or these configuration checks alone.

## Scope correction

The owner withdrew GitLab publication/public links and GitHub deletion on
2026-11-22. Earlier directory names are historical workspace names, not
permission to retire GitHub. CircleCI/Entra replace that abandoned trial.

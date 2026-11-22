# Tasks

## 0. Publication feasibility before cutover

- [x] 0.1 Record an actual CircleCI Free hosted job without a payment card,
  the exact organization/project/pipeline/context identifiers and a successful
  OIDC exchange for @openspec-ui/cli in publication-preflight.md. Hosted
  runs #1/#2 succeeded; run #2 exchanged a package token without publishing.
- [x] 0.1a Add an authentication-only .circleci/config.yml and
  scripts/check-circleci-npm-access.mjs. Before pushing, run only
  node --test scripts/check-circleci-npm-access.test.mjs, scoped ESLint on
  those two scripts, YAML parsing and strict OpenSpec validation. Initial
  identity discovery may use the dedicated circleci-project-setup branch;
  exchange requires an exact approved context bound to that same branch.
  No application build/test suite or registry version is run/published there.
  Five offline tests, changed-path ESLint, YAML parsing and strict validation
  passed; hosted identity and package exchange passed on 2026-11-22.
- [x] 0.2 Add scripts/check-marketplace-entra-access.mjs and its named test.
  Verify the approved certificate, actual Marketplace profile, direct
  Contributor role and unchanged publisher/extension ids. Evidence on
  2026-11-22: 5 offline tests passed; live identity and strict role probes
  passed; installed vsce 3.9.2 verify-pat with --azure-credential passed.
  No registry version was published. Remote executor deployment is separate.
  Scoped static check: run the installed ESLint CLI with the original root's
  eslint.config.js only on scripts/check-marketplace-entra-access.mjs and
  scripts/check-marketplace-entra-access.test.mjs. Neither file is TypeScript.
- [ ] 0.3 Record the first legitimate release's remote identities and exact
  assets. Never publish a disposable test version to activate a trust.
- [x] 0.4 Supersede the abandoned GitLab MR/preflight and review exact unused
  GitLab grants for cleanup after replacement access works. GitLab MR !1 is
  closed unmerged. After hosted npm exchange, the owner-approved federation
  gitlab-main-marketplace and npm connection GitLab release publisher were
  deleted. Entra retains its certificate and passes the strict live role
  probe; npm lists only the preserved GitHub and new CircleCI trusts, both
  Valid. The UI confirms successful deletion; no package was published.

## 1. Preservation and final architecture

- [ ] 1.1 Inventory refs, tags, release metadata/assets/hashes, open PR heads
  and dirty user branches in docs/migration/gitea.md. Preserve PR #1009 and
  unrelated active work. Verify recoverable backups before conflicting writes.
- [ ] 1.2 Integrate the final Publication Center commits/manifest contract;
  reconcile its release-quality and worker specs with ADR 0059. Do not edit
  another worktree or claim the unfinished draft is deployed.
- [ ] 1.3 Accept docs/adr/0059-gitea-ci-and-independent-publication.md only
  after actual publisher and Gitea runner evidence. Keep both GitHub repos
  permanently as public mirrors/Release hosts; there is no retirement date.

## 2. All CI in Gitea

- [ ] 2.1 Port the complete named Quality inventory into
  .gitea/workflows/quality.yml, including independent security/review,
  OpenSpec validation, real extension, browser/accessibility and package smoke.
- [ ] 2.2 Implement version PRs, lockfile consistency, stable tags, immutable
  artifacts and serialized release preparation in .gitea/workflows/release.yml.
- [ ] 2.3 Implement dependency proposals in .gitea/workflows/dependencies.yml,
  retaining independent audit semantics and deliberate major upgrades.
- [ ] 2.4 Record exact required checks, protection and run URLs. Finish the
  preserved issue-to-Propose PR through real Gitea CI rather than billing bypass.

## 3. Mirror and publication executors

- [ ] 3.1 Add scripts/mirror-tested-release.mjs and named tests for exact
  source/tag matching, target allowlists, existing assets and hash conflicts.
  Upload GitHub Releases through REST API without GitHub Actions.
- [ ] 3.2 Add publication-only .circleci/config.yml consuming eligible
  Homepage jobs and authenticated Gitea receipts. Reject foreign refs, altered
  hashes, arbitrary URLs and duplicate version writes. No application rebuild.
- [ ] 3.3 Add the isolated Entra Marketplace worker against the accepted
  Homepage lease/completion API. Deploy the certificate only to that executor,
  verify service networking and document expiry/rotation. Keep the Flask
  process and untrusted PR jobs without access to the private key.
- [ ] 3.4 Adapt scripts/check-publish-workflow.mjs and its named tests to the
  independent executors and accepted Homepage eligibility. Enforce one writer
  per channel, no permanent npm token fallback and no untrusted artifact input.
- [ ] 3.5 Replace GitHub quality/publish/homepage-dispatch jobs with disabled
  transition notices only after replacement CI, mirror and publishers pass.
  Keep public source/docs/feedback URLs unchanged.

## 4. Verification and delivery

- [ ] 4.1 Record the exact selected local tests, lint paths and TypeScript
  projects before implementing each part. Never run full verification locally.
- [ ] 4.2 Validate move-ci-to-gitea strictly and review changed paths before
  the Gitea PR. Complete full required checks in Gitea and record their links.
- [ ] 4.3 Verify the deployed Homepage queue, lost-notification recovery,
  retries, duplicate refusal, unchanged historical downloads and install ids.
- [ ] 4.4 Assess final public behavior for Changesets to extension/server/CLI;
  record why infrastructure-only portions do not need a product bump.
  Preserve authored notes from the accepted Publication Center change.
- [ ] 4.5 Merge only after required checks, archive with standard OpenSpec
  commands and land the archive in authoritative main. Mirror accepted main.
- [ ] 4.6 Confirm remote main contains every needed commit and owned worktrees
  have no needed unsaved/untracked work; remove only this task's completed
  worktrees and local branches with normal git worktree remove.

## Scope correction

The owner withdrew GitLab publication/public links and GitHub deletion on
2026-11-22. Earlier draft paths/branch names are historical workspace names,
not permission to retire GitHub. CircleCI/Entra replace that publication trial.

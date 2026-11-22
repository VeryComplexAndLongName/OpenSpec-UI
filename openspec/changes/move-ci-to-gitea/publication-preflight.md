# Publication feasibility before migration

Status: In progress. This is observed readiness, not proof of a registry write.

## Current owner decision

On 2026-11-22 the owner superseded GitLab publication and GitHub retirement.
Gitea owns all CI; GitHub remains the public mirror and Release host; Homepage
controls publication. Evaluate CircleCI Free for npm without a payment card
and certificate-authenticated Entra for Marketplace. Earlier GitLab evidence
below is historical and does not authorize continued GitLab setup or GitHub
deletion. See ADR 0059, now named
`0059-gitea-ci-and-independent-publication.md`.

## Current access evidence

- CircleCI account access succeeded. Organization `OpenSpec Workbench` was
  created without a payment card. Its home shows 30,000 free credits and
  URL `https://app.circleci.com/organization/circleci/8aWYi8G89ikBPGoYjr3Bix`.
  Organization UUID: `3d5db94d-4a2c-499e-82f5-af1f9fd28d49`, observed in
  its usage report URL. Plan overview explicitly shows `Current plan: Free`
  and 30,000 credits per month; paid checkout was not entered.
  Project `OpenSpec npm publisher` has id
  `1bee6918-ef0a-424e-9775-cfd25745b0cd`; pipeline `npm-publication` has
  definition id `ff640ebf-283f-4f8a-b58d-5ab8acc9494e`. The owner approved
  CircleCI App installation only for OpenSpec-UI; setup now lists that repo
  and installation `184623029`. The initial trigger is default-branch pushes.
  Actual hosted execution and npm exchange remain pending.
- The owner added certificate thumbprint
  `490FD4FE9CB6A31479EC3D1572D79A2EE55C2603` to the existing Entra app.
  Credential id: `d1b5a10d-f669-4355-ac93-df9b6c1e9981`.
  Expiry: 2027-02-20 10:21:26 UTC. The private PEM is in a protected local
  secret directory outside all repositories, with inheritance disabled and
  access limited to the current user and SYSTEM. No private key was uploaded.
  Production executor transfer and rotation remain pending.
- A real certificate token exchange succeeded. The returned tenant, client
  and enterprise principal matched the approved application.
- Its actual Marketplace profile is
  `6165b075-4cec-6f3f-b392-ad15b7c7536e`. The approved direct Contributor
  grant was saved on publisher `openspec-ui`; the original owner remains.
  A strict live role query and public gallery identity check passed for
  the unchanged publisher and extension ids below.
- Installed vsce 3.9.2 successfully ran
  `verify-pat openspec-ui --azure-credential` with the certificate environment
  and PAT/client-secret overrides removed. Record this together with, not
  instead of, actual Contributor verification.
- All 5 offline tests in `scripts/check-marketplace-entra-access.test.mjs`
  passed on Node 24.21.0. The probe rejects wrong identities, Reader/foreign
  assignments and changed extension ids, bounds certificate assertions,
  refuses redirects and withholds sensitive error bodies.
- No registry version, VSIX or article was published by these probes.
- Gitea's repository runner endpoints currently list zero assigned runners
  for both targets. Instance runner availability remains a separate check;
  this is not proof that a complete quality pipeline can execute.

## Owner priority

Before changing deployment or provider authority, prove that replacement
publication can update the existing registry identities. Do not create
a replacement npm package, Marketplace publisher or extension. Do not publish
a disposable test version to prove authentication.

## Baseline identities and historical GitLab trial on 2026-11-22

| Channel | Existing identity | Observed owner | Current release | GitLab authorization |
| --- | --- | --- | --- | --- |
| npm | `@openspec-ui/cli` | `verycomplexandlongname` | `0.33.0` | Additional GitLab trust saved; pending first publish; no job probe yet |
| Marketplace | `openspec-ui.openspec-ui-vscode` | Alexander Ivanov, Owner of `openspec-ui` | `0.110.0` | Entra application and federation saved; publisher Contributor grant approved but not applied yet |

Public registry metadata names the latest npm publisher as `GitHub Actions`.
Changing the CI executor need not change package ownership, but its audit label
and authentication principal may differ. Preserve that distinction in user
communication; do not promise the same technical principal.

Marketplace's public identifiers are publisher
`5ece82ef-e623-4c63-ae77-ee9261e4ca19` and extension
`8082245e-9666-438c-8680-4e447f5eef72`. Its authenticated Members page showed
the existing owner. The Trusted Publishing page says it supports GitHub
Actions and currently lists no policies. A direct GitLab Marketplace OIDC
policy is therefore not an established route.

## Historical GitLab targets

- `verycomplexandlongname/openspec-workbench`: project id `89300761`, public.
- `verycomplexandlongname/openspec-workbench-homepage`: project id `89300771`,
  private, empty repository, accessible in the user's authenticated browser.
- Browser identity is `verycomplexandlongname`. The Homepage project's instance
  runners are enabled and list online shared runners. No publication job has
  executed, so availability in settings is not execution evidence.
- The user completed Git Credential Manager OAuth with `read_repository` and
  `write_repository`; authenticated Git access to both targets now works.
  `GITLAB_TOKEN` and `GITLAB_ACCESS_TOKEN` are not set at process, user or
  machine scope. A future API client can read `GITLAB_TOKEN` automatically,
  without printing it or placing it in Git remote URLs.
- A strictly verified GitLab host key matched the official ED25519 fingerprint
  `SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8`, using a task-owned
  temporary known-hosts file. The existing local SSH key was rejected. No
  existing SSH configuration or user known-hosts file was weakened or changed.
- Product GitLab main originally held only README commit
  `0454ff0f0d2fe96a2f55fe0cd5a17da76320d630`. This history is preserved.

## Historical GitLab non-publishing plan (superseded)

1. Add GitLab.com as an additional trusted publisher of the existing npm package,
   preserving the working GitHub configuration during verification. Pin the
   exact project, CI configuration and protected environment/ref. Use a hosted
   shared runner, not the internal Gitea runner.
2. Execute a GitLab authentication-only job and verify npm's exchanged identity
   is authorized for this exact package. A local pack or `npm publish --dry-run`
   alone is not proof of remote write authorization.
3. Establish an Entra tenant/application/federation path, grant only the required
   rights on the existing Marketplace publisher, and execute `vsce verify-pat
   openspec-ui --azure-credential` from the actual GitLab job. Verify that the
   publisher and extension ids match the baseline. Inspect the actual role
   assignments for the publishing principal and require Contributor (or an
   explicitly approved equivalent with update rights). `vsce verify-pat`
   also succeeds for Reader, so it does not establish write permission by
   itself. Do not declare successful Azure sign-in alone sufficient for
   Marketplace publishing.
4. Exercise artifact validation, disallowed refs, changed hashes and duplicate
   version refusal without calling a publish command.
5. The first legitimate release through the new path is the final end-to-end
   publication proof. Confirm it appears under the same package/extension and
   existing install/update URLs before declaring cutover complete.

## Saved npm connection

The user completed npm security-key authentication. The settings page then
reported `Successfully added new Trusted Publisher connection.` The old
GitHub connection remains present and valid.

- GitLab project: `verycomplexandlongname/openspec-workbench`.
- Top-level CI configuration: `.gitlab-ci.yml`.
- Environment: `npm`.
- Label: `GitLab release publisher`.
- Allowed operations: direct `npm publish` and the always-available
  `npm stage publish`.
- Separate `npm dist-tag` management was not enabled. A normal publish can
  assign its publication tag; moving/removing tags on already-published
  versions is a separate permission and has no established migration use yet.
- Status: `Pending validation`. The UI requires a first successful publish
  before **2026-11-24 09:51 UTC** (12:51 Europe/Moscow). An authentication-only
  probe does not satisfy this first-publish requirement. If the connection
  expires before a legitimate release, recreate it rather than inventing a
  disposable release.

An npm OIDC exchange probe must run in the real GitLab hosted job and keep
all returned tokens in memory, without logging JWTs or response bodies.
`npm whoami` is not a test of trusted publishing permissions. Even a successful
exchange is narrower evidence than a completed publish.

## Original Entra registration and historical GitLab federation

The user's existing `Default Directory` tenant is available, and the user
explicitly approved registration of the single-tenant application
`OpenSpec GitLab Publisher` without a client secret.

- Tenant: `98c88ff6-1c8a-4943-97d1-dd2774508ee9`.
- Client: `f357cdfe-d7cf-441e-9cb0-889fb8cf8897`.
- Application object: `091ca467-9119-46c3-b633-2789e40c2e54`.
- Enterprise application/service principal object:
  `5e2339f2-50c5-4b0c-82bd-4857dff6f790`.

The owner approved and the portal successfully saved the federated credential
on 2026-11-22. It uses issuer `https://gitlab.com`,
audience `api://AzureADTokenExchange`, name `gitlab-main-marketplace`, and
the exact claims expression:

```text
claims['sub'] eq 'project_path:verycomplexandlongname/openspec-workbench:ref_type:branch:ref:main' and claims['project_id'] eq '89300761'
```

The immutable project id is checked in addition to the mutable path. No
wildcard branch, tag, other project, tenant administrator role, subscription
role, or client secret is requested. Contributor access must be assigned to
this application's actual Marketplace profile identity, not an unrelated
user or the application registration object id.

## Authentication-only merge request

GitLab merge request
https://gitlab.com/verycomplexandlongname/openspec-workbench/-/merge_requests/1
adds only the explicit web/main preflight and its own OpenSpec tooling change.
Branch `gitlab-publication-preflight` is based on the preserved GitLab initial
commit, not a forced source import. All 6 offline tests, strict OpenSpec
validation and YAML parsing passed on Node 24.21.0. The preflight checks a
protected main ref, exchanges only short-lived credentials and has no package,
VSIX or dist-tag publication commands. It is not a product CI migration.

## Historical GitLab blockers (not replacement prerequisites)

- At the time of the GitLab trial, federation and existing-publisher
  Contributor membership were approved, but profile discovery was blocked.
  The current certificate-based evidence above supersedes that state.
- GitLab now displays `Verify your identity to run this pipeline` on the real
  merge request and directs the owner to `/-/identity_verification`. This
  account-level runner gate is distinct from a Git token expiry. No successful
  hosted execution is established yet. The page offers credit-card verification
  and `Verify with a phone number instead?`. The owner must complete this
  personal verification; no card, phone or verification code is collected by
  this tooling. A refreshed API/Git token cannot satisfy that account gate.
- GitLab hosted execution, package-specific npm authorization, and Marketplace
  write-role verification remain unproved.
- No source/publication/deployment switch, registry write, package ownership
  change or repository deletion has been performed.

The GitLab preflight MR !1 was closed without merging after the owner's
revised decision. Its source branch and the initial main commit remain intact.
The obsolete GitLab federation and npm trust await exact reviewed cleanup
after replacement access is proved. No GitHub deletion is scheduled.

## Primary references

- https://docs.npmjs.com/trusted-publishers/
- https://docs.gitlab.com/ci/cloud_services/azure/
- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://raw.githubusercontent.com/microsoft/vscode-vsce/main/src/auth.ts
- https://raw.githubusercontent.com/microsoft/vscode-vsce/main/src/store.ts
- https://learn.microsoft.com/en-us/entra/workload-id/workload-identities-federated-credential-mutable-subjects

The local installed `@vscode/vsce` is 3.9.2 and contains the Entra credential
path. The exact version used by the eventual publisher must be pinned and
verified; the separate Publication Center worktree must not be changed here.

# Gitea development and independent publication

## Authorities

- Development: `http://hppiigit:3000/root/OpenSpec-Workbench` and
  `http://hppiigit:3000/root/OpenSpec-Workbench-Homepage`.
- GitHub retains `VeryComplexAndLongName/OpenSpec-UI` and
  `VeryComplexAndLongName/OpenSpec-UI-Homepage` as code mirrors. The product
  remains public; the Homepage repository retains its existing private visibility.
- Existing GitHub Releases, asset URLs, package names, publisher and extension
  identifiers remain unchanged. There is no GitHub deletion date.
- Homepage owns article and registry publication eligibility and durable outcomes.
- CircleCI only executes npm publication with native OIDC. The isolated
  Marketplace service only executes approved VSIX publication with Entra.

## Preservation checkpoint

Before import on 2026-11-22, source refs, tags, release metadata and open PR
heads were saved in the operator's private migration checkpoint. The complete
product bundle was restored into a bare repository and passed git fsck; it is
not the earlier shallow bundle. All 215 product tags and current GitHub PR
branches were imported. PR #1009's source is retained for checked delivery.
Existing release assets remain at their original GitHub destinations; this
migration does not overwrite or delete them. The metadata inventory retains
asset ids, sizes, URLs and any upstream-provided digest.

The original dirty Homepage checkout and other worktrees are not migration
scratch space. Preserve its two modified files and raw diff privately. Only
worktrees created by this migration are candidates for later removal.

Production's consistent SQLite backup passed integrity_check. Code, service
units, Caddy configuration and private settings were archived on the server
under `/root/openspec-gitea-migration-20261122`, mode 0700. The database backup
SHA-256 is `4d57aecde715fbf9d8fbc3ac55d141124d4ca3555d7384f462ee5f620b797068`.
Private settings are never part of a public release archive.

## Checks and trusted authors

The dedicated owner-scoped runner `openspec-ci`, id 24, runs one job at a time
with 2 CPUs, 6 GiB memory and an init process. Jobs have no privileged mode,
host bind mounts or Docker socket. The runner daemon necessarily controls its
Docker host. These repositories accept trusted internal authors; public
untrusted contributions require an isolated ephemeral VM. Gitea repository
secrets are not GitHub environment approvals and must not be described as such.

Both authoritative main branches refuse direct/force pushes and require their
Gitea aggregate PR check. Product checks retain typecheck/lint/unit/build,
independent audit and changed-dependency review, OpenSpec validation, actual
extension integration, browser/accessibility and installed CLI package smoke.
Version PRs retain their distinct install/build/package path and authored notes.
Homepage retains Python 3.12/3.14 and the exact deployed dependency lock.

## Release and retry path

1. Gitea Quality packs one CLI tarball, installs and exercises that exact file,
   and retains it beside the typed `releases-base.json`. The native extension
   job retains its VSIX. The Gitea-compatible artifact v4 action is pinned to
   commit `81f940d004763f986ba3582c007fd842dd5cb0d7`; v3 uploads are not exposed
   through the v4 REST artifact API.
2. The scheduled release producer checks completed, successful main run metadata
   and every required job. It never waits while holding the only runner slot.
3. The scoped GitHub App mirrors main with a normal fast-forward push. The
   producer stages a signed approval before uploading exact CI bytes into Gitea
   and existing GitHub Releases. A conflicting tag or asset is an error.
4. `release-manifest` receives ordinary append-only commits. Unchanged product
   versions retain their dates and historical links. `publications.json` holds
   at most 100 signed candidates; previously published baseline versions are not
   turned into newly approved builds.
   A signed worker-source receipt binds the Marketplace runtime's exact commit
   and fixed file hashes to the same successful Gitea run. Homepage verifies it
   before deploying privileged code. A verified producer checkpoint prevents
   repeated scheduled asset downloads from inflating the public download totals.
5. Homepage polls the contract, retains its verified Ed25519 receipt and leases
   eligible work. Workers verify the signature, fixed URL, inner product identity
   and SHA-256 before a registry write. They reconcile the registry before retry.

If upload fails, rerun the producer. It reuses the staged original receipt and
stored bytes, or the original Quality artifact whose hash must still match.
Never rebuild or replace an approved version to make recovery convenient.
Homepage's database retains discovered jobs after entries leave the bounded
contract. A missing notification does not remove work; timers recover it.

## Credentials and rotation

Gitea release preparation needs `MIRROR_APP_ID`, `MIRROR_APP_PRIVATE_KEY` and
`RELEASE_SIGNING_PRIVATE_KEY`. The App is limited to the two mirror repositories
with Contents write and mandatory Metadata read. It obtains short installation
tokens. It does not publish to npm or Marketplace. Retire GitHub workflows
before the one-time mirror bootstrap; future mirrors need no Workflows write.
Store both private-key secrets as canonical single-line base64 of their PEM
bytes. The producer decodes them only inside Node. Do not expose multiline PEM
in action inputs or environment values: Gitea's escaped environment logging can
miss multiline masking. The Homepage mirror uses the same encoded transport,
and its short installation token is revoked after the fast-forward attempt.

CircleCI uses organization `3d5db94d-4a2c-499e-82f5-af1f9fd28d49`, project
`1bee6918-ef0a-424e-9775-cfd25745b0cd`, pipeline definition
`ff640ebf-283f-4f8a-b58d-5ab8acc9494e` and context
`dd0462b9-a028-418b-9591-91d1ef9cee78`. Its context must require main and disabled
SSH debugging. Schedule the GitHub App pipeline in Project Settings -> Project
Setup; a legacy scheduled-workflow stanza does not support this integration.
The account's Free hosted OIDC exchange passed without a payment card. npm
shows the CircleCI trust as Valid; the original GitHub trust remains intact.

Marketplace keeps application `f357cdfe-d7cf-441e-9cb0-889fb8cf8897` and publisher
`openspec-ui`. The approved certificate thumbprint is
`490FD4FE9CB6A31479EC3D1572D79A2EE55C2603`, expiring 2027-02-20 10:21:26 UTC.
The private PEM is root/openspec-publisher readable under `/etc/openspec-publisher`.
Only the public certificate reaches Flask. Root owns runtime code; the worker
user cannot replace it. Rotate by registering a new public certificate in Entra,
updating the pinned verifier and worker private file together, checking the actual
Contributor assignment and native vsce verification, then retiring the old cert.
`verify-pat` alone is not proof of publishing permission: Reader can pass it.

GitLab trial MR !1 was closed, and its npm trust and Entra federation were
removed after replacement access passed. Do not delete the valid certificate,
existing npm owners or original GitHub npm trust as incidental cleanup.

## Delivery evidence

Access probes, local selected tests and live Gitea runs are distinct evidence.
See the active change's evidence file for actual commits, deployment markers,
first legitimate registry versions and cleanup. Do not claim cutover based on
configuration or a dry run alone. No disposable registry version or social post
is needed to test the migration.

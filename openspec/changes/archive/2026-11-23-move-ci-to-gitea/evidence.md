# Migration evidence

Actual main version workflow 6762 succeeded and created PR 4, but that head had
no CI run. Gitea v1.26.4 services/actions/notifier_helper.go explicitly ignores
events whose actor IsGiteaActions. The replacement maintenance account is
restricted, non-admin, has zero repository/organization creation and write grants
only on these two repositories. Its write:repository token is confined to
proposal checkout/push/API jobs, so normal PR events can create required checks.
The first automatic proposal run with that identity remains acceptance evidence.

Production watch run 6760 revealed that Gitea escaped multiline environment
values before masking and disclosed the dedicated SSH key. That key was
replaced, the new key's actual SSH probe passed and only the exposed old key
was removed from authorized_keys. Existing user keys were preserved. Before
the first producer run, its signing secret was converted to canonical
single-line base64; all producer key decoding now happens inside Node, not in
logged action parameters. The same representation is required for the mirror
App key when approved. Selected JWT/receipt/mirror/policy tests and ESLint pass.

## Preserved feature and actual artifact API

Release and deployment eligibility query Gitea with both `event=push` and the
exact `head_sha` before inspecting Quality. Scheduled producer/deploy runs must
not push the approving main build out of a page of 50 unrelated runs and block
delayed recovery. The live Gitea Swagger and both filtered API calls confirmed
these supported filters and returned only the matching actual main Quality.
Eleven selected mirror/receipt tests and scoped producer ESLint passed.

Gitea PR 2 passed full run 6742 at 5937a525, operator review 11 and merged as
93a25199722e576e0cc1d7820281895a57785921. Its standard OpenSpec archive and
accepted change-editor-workbench requirement are included after that merge.

Migration run 6743's quality job 8992 passed the installed prepared CLI archive
smoke. Both patched v4 artifacts were listed and downloaded through the actual
Gitea REST API, and their inner package identities were verified:

- CLI artifact 11537: @openspec-ui/cli 0.33.0, SHA-256
  `1ed3e3dd8bf674ee758c5a07fc129dd7a9375f2b99410d73bb6e30856ef30267`.
- Native VSIX artifact 11538: openspec-ui.openspec-ui-vscode 0.110.0, SHA-256
  `803610cab723c532fae6c8bcbe447484c6af292723649ee96c782733258854a8`.

These are verification artifacts, not new registry versions. Run 6743's
OpenSpec gate correctly refused the then-open evidence tasks 2.4 and 3.0;
they were completed only after the feature merge and actual artifact downloads.

The retired GitHub release helpers `scripts/release-cli.mjs` and
`scripts/publication-manifest.mjs` were removed. They could rebuild a CLI
outside the approved Gitea artifact flow or emit an unsigned queue contract.
The replacement mirror/receipt/worker coverage validates exact bytes, source,
stable identity, duplicate assets, historical manifests and altered receipts.
The 16 selected worker/mirror tests and changed-file ESLint passed after removal.

## Access and existing identities

See publication-preflight.md for actual hosted CircleCI identity/exchange runs
without a card. Both remaining npm trusts are Valid; the obsolete GitLab trust
and Entra federation were removed with owner approval. No package was published
to activate a trust. Existing owners, publisher and extension ids are unchanged.

From the actual Homepage server, the approved certificate authenticated as
application f357cdfe-d7cf-441e-9cb0-889fb8cf8897 and profile
6165b075-4cec-6f3f-b392-ad15b7c7536e. The exact profile has Contributor on
openspec-ui; its native vsce certificate verification succeeded. The isolated
account cannot replace runtime code, and the homepage account cannot read the PEM.
No Marketplace write has occurred. The final worker and API rollout remain pending.

## Selected local verification

- Initial CircleCI probe: 5 named offline tests and changed-file ESLint passed.
- Entra probe: 5 named tests and changed-file ESLint passed.
- Worker/receipt/mirror scopes: 21 tests passed after signed runtime/checkpoint
  integration, including altered bytes, wrong source/purpose, immutable tag and
  asset conflicts, lost responses and duplicate refusal.
- Publisher policy: 9 mutation tests passed, including main/context, rebuild,
  long-lived token, multiple writer and serialized-channel refusal.
- Maintenance proposals: 2 named allowed-path/VS Code-baseline tests passed.
- Changed-file ESLint, actual YAML/bash syntax and strict OpenSpec passed.
  The modified publication-center delta requires archiving its prepared base
  first; this is the explicit final archive order, not an ignored spec change.

No application TypeScript changed and no full verification ran locally. The
prepared-tarball script's syntax/ESLint passed; its actual package smoke and v4
artifact download proof await this migration's Gitea run.

## Real Gitea bootstrap

http://hppiigit:3000/root/OpenSpec-Workbench/actions/runs/6734 passed all expected
regular-PR jobs on d7d49f8d6ec996a9816aca66da617888cfbad864. Native job 8958
verified Microsoft's VS Code 1.147.0 SHA-256, ran 23 integration tests and saved
its exact editor cache. Earlier full-stream downloads stalled; bounded 1 MiB
ranges resolved it without skipping tests. Review 10 approved bootstrap PR 1,
merged as ef91b62ad69669a0b1a440a1364fa396df034e8d.

Runner 24 is dedicated to the two root-owned repositories, capacity one, 2 CPUs,
6 GiB, init enabled and no job Docker socket/host mounts/privilege. Its cache
is bound to private 192.168.137.34:8095; an unauthenticated request returned 401.
The runner was drained before recreation and re-enabled. Other project runners
were not changed. The archive follows the main merge and is retained in this
owned migration branch pending its own required main merge.

## Preservation and pending delivery

The complete product bundle restored and passed git fsck. All 215 tags and
current PR branches were imported. Existing GitHub assets remain at their
original hosts without replacement. The original dirty Homepage checkout's two
files and raw diff were copied privately without modification. The server's
consistent SQLite and code/service backups passed their checks; a private
record snapshot retains 18 dev.to, 2 LinkedIn and 403 release rows before cutover.

Gitea PR 2 now retains GitHub PR #1009 and has the new main checks merged into
its source branch. Its passing head and final merge still need recording.

The mirror App awaits the owner's action-time approval. No mirror App key has
been created, no actual GitHub Actions disablement or registry cutover has run,
and the final CircleCI main context/recovery schedule is not active yet.
RELEASE_SIGNING_PRIVATE_KEY is stored in Gitea; its public key is committed in
both paired branches. Actual migration CI, deployed queue/worker verification,
the first legitimate release and final archival/cleanup remain mandatory.

## Weekly proposal acceptance correction, 2026-11-23

Actual scheduled dependency run 6898 refused its lock refresh because the initial
migration guard incorrectly assumed a 1.90 compiler baseline. The existing lock
already resolved 1.125.0. An attempted 1.90 declaration exposed the inconsistency
through actual CI runs 6903 (lock mismatch) and 6913 (ChatRequest.model typing).
Run 6918 also showed that narrowing the declaration to ~1.125.0 conflicts with
vsce's engine/declaration check, despite all 23 native tests passing. The final
implementation retains both original manifests and lock bytes. It names the
49 eligible dependencies explicitly in npm update, excluding editor types and
local workspace names. The guard compares actual workspace resolutions with
the pre-update committed lock instead of assuming a historical minimum.
The real weekly proposal must be retried after this correction passes full CI.

The legitimate version PR 6 passed full run 6779, review 17 and merged as
ae9bdad8ad845dec82362a66bb2c0fb7d4c6bc13. Its main Quality run 6782 also passed.
The pending registry versions are CLI 0.34.0 and extension 0.111.0. Successful
producer run 6915 mirrored their exact signed artifacts into GitHub Releases.
The owner approved the scoped App, main Circle context and mirror protections;
both actual Actions settings are disabled, source histories fast-forwarded,
App-only main updates enforced and Homepage privacy retained.

An isolated real npm 10.9.0 package-lock-only refresh of all copied workspace
manifests passed: 49 eligible names, original manifests unchanged and the existing
compiler resolution retained. No source, package declaration or lock modification
remains in this correction. No public version bump or empty Changeset is needed.

The actual scoped GitHub App probe also exposed that HTTP 204 has a null body.
The transport now accepts successful bodyless responses, with an explicit token
revocation regression test. Twelve named proposal/mirror tests and scoped ESLint
passed; full Gitea verification must run on the corrected PR head.

## Actual first registry writes and probe correction

Marketplace's native publisher and CircleCI run 4 both accepted the legitimate
0.111.0/0.34.0 archives. Immediate public registry confirmation was delayed, so
Homepage retained retry state instead of declaring success from process exit.
The public npm version endpoint subsequently returned 0.34.0 with latest 0.34.0.

CircleCI run 4 selected publication-probe=true in the UI, but the step environment
did not select the worker's exact-string probe mode and it claimed eligible work.
Export the parameter as a quoted shell string immediately before Node and refuse
ambiguous probe environment values before a claim. The hosted no-claim probe
must be repeated after this correction passes CI and reaches the mirror.

## Confirmed cutover, 2026-11-23

The dependency/transport correction passed complete Quality 6925, review 19 and
merged as 97581892d2557a31b53e1a1005e2b4e0ed14c86d. Main Quality 6934 passed.
The actual dependency proposal run 6937 succeeded, created review-only PR 9
and triggered complete passing Quality 6943. It was not automatically merged.
The old GitHub Version Packages PR 1000 was closed only after its unchanged
head matched the preservation inventory and the legitimate versions were public.
GitHub PR 1009 was automatically recognized as merged through preserved ancestry.

The actual Gitea producer 6915 published the approved archives from successful
main Quality 6782 at ae9bdad8ad845dec82362a66bb2c0fb7d4c6bc13. Later automatic
producer 6952 mirrored accepted main without replacing existing assets or
inflating self-download totals. Signed artifact and six-file worker-source
receipts were independently verified.

Public npm latest and the version endpoint both report CLI 0.34.0. Downloading
the registry archive returned the exact approved SHA-256
aa0659a6adf157a491242d6ad20eb2ca2ad5076d2cf3a38846725daec717a117.
Marketplace publicly reports extension 0.111.0 with unchanged publisher
5ece82ef-e623-4c63-ae77-ee9261e4ca19 and extension
8082245e-9666-438c-8680-4e447f5eef72. The approved VSIX SHA-256 is
8b915382e67097a819345ade725b3b2dfb4046dd75cadeb2adf539457b94bb62.
Both versions appear on openspec-ui.dev. Marketplace's scheduled timer confirmed
publication at 05:51:32 UTC; automatic Circle push pipeline 5 succeeded at
06:08:09 UTC, reconciling the existing npm version without another upload.
Homepage records both jobs as published, with two npm and three Marketplace
attempts. No disposable version or social test post was created.

Mirror App 5882677 is installed only on the two approved repositories, with
Contents write and mandatory Metadata read. Scoped installation tokens were
verified and revoked. The orphan first key was removed after explicit owner
confirmation; the sole remaining working key is protected in Gitea Secrets.
Both GitHub repositories have Actions disabled. Product main is App-update-only
with deletion/non-fast-forward protection retained. The private Homepage
GitHub plan refuses rulesets with HTTP 403; privacy was preserved, authoritative
Gitea main is protected and the mirror refuses non-fast-forward updates.
The owner's npm/package and Marketplace identities did not change.

The Circle probe correction passed complete PR Quality 6955, review 21 and
merged as cfbe8a8cfde9917f40a77034f6fe0741825850d7. The existing browser fixture
passed its configured retry; no test or gate was bypassed. Main Quality, the
corrected hosted probe and first successful scheduled recovery remain required.

The paired Homepage correction passed main Quality 6936 and scheduled deployment
6948. Production serves 5f314398211538133def3565c64d0202dc8bc664, homepage.service
is active, root/healthz/sitemap return 200 and an unauthenticated worker returns
401. A read-only database comparison preserved every original field of all
403 release rows, 18 dev.to confirmations and 2 LinkedIn confirmations.
Its actual watch 6951 passed. Original credentials and future article holds
were preserved.

## Actual social executor previews

Gitea workflow_dispatch runs 6971 (devto.yml) and 6972 (linkedin.yml) both
completed successfully against deployed main. Inputs were dry_run=true and
refresh_token=false. The real SSH wrappers executed the server task entry
points; no credential rotation, timer change or social publication was requested.
Future article and cover checks remain subject to their original dates.

## Browser fixture correction

The complete PR 6955 and main 6965 browser jobs each exposed the same ordered
fixture failure: the PR-review scenario commits the exact spec text later
written by archive-preview, so its first commit is empty. The configured retry
recreates the shared fixture and passes. Give archive-preview its own requirement
name, preserving its actual scenario and visible diff assertion.

Changed-file ESLint passed. An isolated native Git check extracted both actual
string literals from pipeline.spec.ts, reproduced the former duplicate commit
failure, and committed the two current bodies in order, leaving two commits
and a clean tree. The selected two-scenario local browser run, with retries=0,
reached both dialogs but timed out awaiting their result headings. It is not
reported as a passing browser check. Complete Gitea browser execution on the
final PR remains a required merge prerequisite and must show both scenarios
passing on their first attempt. Original checkout files and dependencies were
not rebuilt or modified; only owned package-local core links and the owned
standalone browser bundle were used for this selected run.

## Corrected hosted main probe

Main Quality 6965 passed on cfbe8a8cfde9917f40a77034f6fe0741825850d7. Producer
6984 succeeded and the GitHub main API reported that exact source. Hosted
Circle pipeline 7, workflow a9d8d424-7634-464f-b673-70d50cb6de32, completed
successfully with both config and checkout main and publication-probe=true.
The downloaded worker step output confirms "Homepage worker identity verified"
and "npm OIDC exchange verified without publishing." A fresh read-only SQLite
snapshot matched all 36 queue rows' channel/key/state/attempt fields exactly
before and after the probe. No lease was consumed or publication attempted.
The first successful recovery-schedule trigger remains the final acceptance.

## Ordered spec synchronization

Standard Publication Center archival created the accepted base specification.
Strict validation against it then caught an omitted non-main event scenario in
the migration's complete MODIFIED worker block. The exact accepted scenario is
retained beside the narrower hostile-identity scenario. Strict validation and
git diff --check now pass without dropping a previously accepted case. The
Homepage replacement block already retains both accepted base scenarios.

## First successful scheduled npm recovery

CircleCI pipeline 8, workflow 5d0783a1-41b7-4ca2-bab3-691f0d754a56, was
triggered by Scheduled / npm publication recovery at 07:04:01 UTC and
completed successfully at 07:04:27 UTC on checked mirror main cfbe8a8c.
The existing main/main trigger is enabled with cron */15 * * * * and the
approved one-project context still forbids SSH debugging. This is an actual
scheduled run, distinct from the successful manual probe and push runs.

Actual scheduled Gitea producer 7000 and Homepage watch 7001 also passed. A
repeat isolated Marketplace API probe confirmed Homepage identity and the
unchanged Entra Contributor assignment without publishing; all 36 queue states
and attempt counters remained unchanged. Native Marketplace publishing had
already been confirmed automatically from the first legitimate release.

Production acceptance is complete. Archive Publication Center before this
migration through normal OpenSpec commands, land synchronized specs and both
archives through required PR checks/review, then verify accepted main mirrors
and the final deployment. These final PR/main outcomes are retained in the
Gitea review records and delivery checkpoint, avoiding self-referential commits.
Owned cleanup follows only after all needed commits are in authoritative main.

## Standard archival

Both repositories ran `openspec archive publication-center --yes`, then
`openspec archive move-ci-to-gitea --yes` on 2026-11-23. Both commands completed
with validation enabled and synchronized accepted main specifications. No
--skip-specs or --no-validate option was used. Purpose text and current runbook
links were completed. This finishing diff still requires its own complete
Gitea PR checks, operator review, main checks, accepted mirror and deployment
verification before the owned working directory can be removed.

The scheduled Circle job's actual shell exported PUBLICATION_PROBE=false. Its
downloaded output was "No npm publications are due." A subsequent read-only
snapshot again matched all 36 queue states and attempt counters exactly. The
standard archive completed in both repositories; targeted accepted-spec checks
and git diff --check passed. The archived product change merge-gate command
returned ok=true with no remaining active affected change.

# Migration evidence

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

# Tasks

## 1. Manifest and Publication

- [x] 1.1 Mark only the Core product non-public; preserve all five stable ids,
  package version sources, links and manifest schema version.
- [x] 1.2 Add assertions that the public product ids are exactly
  `vscode-extension`, `standalone-app` and `ci-cli`, and that Core and Shared UI
  remain present but non-public.
- [x] 1.3 Include public/private state in `versionFingerprint`; verify a
  visibility-only change changes the fingerprint while commit and generation
  time do not.
- [x] 1.4 Update CLI help and README to describe the visibility-aware
  fingerprint; add a minor changeset for `@openspec-ui/cli`.
- [x] 1.5 Add a `release-quality` spec delta for the public product set and the
  publication behavior for visibility-only changes.

## 2. Verification

- [x] 2.1 Run the focused `release-manifest.test.ts` suite: Node 24.21.0,
  npm 10.9.0, 21/21 tests passed with one worker. Command:
  `npm exec --offline --yes --package=npm@10.9.0 -- npm run test --workspace @openspec-ui/cli -- src/release-manifest.test.ts --maxWorkers=1 --minWorkers=1`.
- [x] 2.2 Run CLI typecheck and lint; both pass. Commands:
  `npm exec --offline --yes --package=npm@10.9.0 -- npm run typecheck --workspace @openspec-ui/cli`
  and `npm exec --offline --yes --package=npm@10.9.0 -- npm run lint --workspace @openspec-ui/cli`.
- [x] 2.3 Run `openspec change validate --strict
  core-is-not-public-on-homepage`; valid.
- [x] 2.4 Transfer post-merge verification to the separately tracked Homepage
  rollout change in PR [#143](https://github.com/VeryComplexAndLongName/OpenSpec-UI-Homepage/pull/143).
  Its tasks 1.1-2.2 remain open until the producer manifest is published,
  synchronized and observed on the live site. Production visibility is not
  claimed by this producer change.
# Tasks

## 1. Manifest Producer

- [ ] 1.1 In `packages/cli/src/release-manifest.ts`, set only `ci-cli.public`
  to true and add its summary; preserve all five ids and package version sources.
- [ ] 1.2 In `packages/cli/src/release-manifest.ts`, add optional `ProductLinks.npm`
  and populate only the CLI destination `https://www.npmjs.com/package/@openspec-ui/cli`.
  Keep schema version 1 and do not invent a GitHub release or artifact.
- [ ] 1.3 In `packages/cli/src/release-manifest.test.ts`, assert four public products,
  only Shared UI private, CLI summary/npm URL, other products without npm links,
  all five stable ids, schema 1, and unchanged attachment behavior.
- [ ] 1.4 In `packages/cli/src/release-manifest.test.ts`, exercise `write manifest`
  serialization so `public`, version and `links.npm` reach the emitted JSON.
- [ ] 1.5 In `packages/cli/README.md`, document CLI public manifest metadata and
  the distinction between the repository version and separately dispatched npm publication.
- [ ] 1.6 Add `.changeset/cli-is-visible-on-the-homepage.md` proposing a minor
  `@openspec-ui/cli` bump. Do not edit package versions directly.

## 2. Verification and Rollout

- [ ] 2.1 Run the focused `packages/cli/src/release-manifest.test.ts` suite using
  the pinned runtime; record counts and command output here.
- [ ] 2.2 Run root `npm run typecheck`, `npm run lint` and `npm run test` unpiped
  with the pinned runtime; record results and package counts here.
- [ ] 2.3 Validate this change with `openspec validate cli-is-visible-on-the-homepage --strict`.
- [ ] 2.4 **Delegated to copilot-cli.** Generate `releases.json` using the exact
  `write manifest` CI invocation and validate it with the companion homepage's
  `app/schemas/manifest.py`; record both commands and evidence for `ci-cli.public`
  and `ci-cli.links.npm`. Do not modify the homepage's production snapshot manually.
- [ ] 2.5 **Human-only.** After companion deployment and the CLI version bump,
  confirm that `.github/workflows/quality.yml` publishes the new manifest and the
  site's sync consumes it. Record run id, manifest commit and observed CLI version.
  A metadata-only merge with an unchanged fingerprint does not satisfy this item.

## Why

ADR 0035 asks the forge for an automatic merge of each archive pull
request and merges nothing itself. Whether an archive then lands depends
on the repository's settings:

- GitHub refuses automatic merge unless the repository allows it. A new
  repository does not, which was seen live on 2026-09-22.
- GitLab and Gitea each have their own switch, which can be off or need an
  approval.
- Where the merge was refused, the pull request waited for a person who
  had not asked for it.

The owner, on 2026-09-22: do everything ourselves, and do not rely on the
repository's settings. The behaviour must be the same and predictable on
every forge, whatever the settings, so the person can trust the product to
finish what it started.

## What Changes

- **ADR 0036**, which supersedes decision 5 of ADR 0035: the product
  follows its own archive pull request and merges it.
- **`Forge` loses `mergeWhenChecksPass`.** `checksOf` and `mergeNow(n,
  method)` become required, and are implemented for GitHub through `gh`,
  GitHub's REST API, GitLab and Gitea. GitHub's API forge no longer uses
  GraphQL.
- **The archive pass follows an open `archive-landed-` pull request.** It
  reads the checks and then:
  - pending: waits;
  - passed, or none ran: merges, trying squash, then merge, then rebase;
  - failed: blocked, with the check named;
  - refused by the forge: blocked, with the forge's reason.
  A pull request it has just opened is read from the next pass on.
- **Hosts follow every five minutes** while an archive pull request is
  open. The editor replaces its 15-minute re-sweep with this;
  `createArchiveFollower` does it for the standalone server. A merged
  archive is fetched at once, so `followMain` brings it to the checkout in
  the same pass.
- The editor says a merge, and warns once per reason where one is blocked.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the archive pass merges its own pull request.

## Impact

- `packages/core/src/gh-pr-gateway.ts`, `http-forges.ts`, `forge.ts`,
  `landed-archive.ts`, `workspace-sweep.ts`, `index.ts`, `harness-config.ts`
  (a doc comment).
- `packages/extension/src/extension.ts`, `packages/server/src/rest.ts`.
- Tests: `landed-archive.test.ts`, `gh-pr-gateway.test.ts`,
  `github-api-forge.test.ts`, `http-forges.test.ts`.
- `docs/adr/0036-the-product-merges-what-it-archives.md`, ADR 0035's
  status, `docs/adr/README.md`, `HARNESS.md`, `README.md`,
  `openspec/README.md`.
- A changeset: core, the server and the extension.

## Explicitly out of scope

- **The `git` stage's rule.** It still refuses to merge where no check ran
  (ADR 0014), because it merges what an agent wrote.
- **Working around a forge's rule.** A required approval or a protected
  branch is reported, never bypassed.

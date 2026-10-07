Asked on 2026-10-07: why landed changes were not archived by OpenSpec
Workbench.

## 1. Code

- [x] 1.1 `packages/extension/package.json`: `activationEvents` for
  `openspec/changes`, `openspec/config.yaml`, `openspec/project.md`
  (design.md decision 1). Test: `activation.test.ts` over the manifest.
- [x] 1.2 `workspace-sweep.ts`: `sweepsAgainSoon`, `awaitingLanding`; the
  follower and the extension use it (decision 2). Tests in
  `landed-archive.test.ts`: the follower sweeps once more after a merge
  and then stops; the four reasons and their repeats; a change whose
  branch is on the server is named.
- [x] 1.3 `landed-archive.ts`: `failureReason` (decision 3). Test: a
  refused push says the `! [rejected]` and `error:` lines.
- [x] 1.4 `workspace-sweep.ts`: `archiveUnread`, and the fetch-failed line
  names the archive (decision 4). Test: a remote that cannot be fetched.

## 2. Documents

- [x] 2.1 A changeset: core minor, extension patch.
  `.changeset/landed-changes-are-archived-without-waiting.md`.

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint`, and the core, extension and
  server tests.
  Typecheck clean; lint 0 errors (3 warnings in lines this change did not
  touch); seven script tests and the English check pass. Core 2160,
  extension 510, server 123 passed. core-git-subprocess 75 of 76: "leaves
  the archive to the host already doing it" failed in the full run on a
  machine at 86% CPU, and in one of three runs on its own (41 s): the
  claim it holds is stale after 30 s (`CLAIM_STALE_AFTER_MS`), and the
  sweep reached the archive later than that. It passed in the other two
  runs, and in three of three on `main`'s code, where the run was
  shorter; nothing this change adds runs before the archive. Left to the
  CI machine.
- [x] 3.2 `openspec validate landed-changes-are-archived-without-waiting
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.
  Valid; the gate reports nothing open.

Reported by the owner on 2026-09-23: an archive pull request had been
waiting an hour. #729, opened 10:39 UTC, checks green by 10:47, nothing
merging it.

## 1. Finishing what it opened

- [x] 1.1 A pass with nothing to archive still follows an archive pull
  request of ours.
- [x] 1.2 Whether one may be open is read offline, from the refs a pruning
  fetch left: an `archive-landed-*` branch still on the server.
- [x] 1.3 Where no such branch is there, the forge is asked nothing, as
  before. A host whose git cannot list refs behaves as it did.

## 2. One archive at a time

- [x] 2.1 A pass takes the advisory claim before archiving and releases it
  after.
- [x] 2.2 A pass that cannot take it archives nothing and says who is
  archiving.
- [x] 2.3 Anything that goes wrong reaching the claim leaves the pass
  archiving as it would without one.

## 3. Checks

- [x] 3.1 Tests: the pull request followed with nothing left to archive;
  the forge still unasked where no branch of ours is on the server; the
  archive left to the holder, with the sentence; and the next pass
  archiving once the claim is released.
- [x] 3.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1883 and 57,
  extension 493, server 116, webui 657. A first run timed out in
  `successor-check.test.ts` on a loaded machine; that file passes in 1.9 s
  on its own, and the whole suite passed again.
- [x] 3.3 The extension's integration suite: 19 passing. The whole
  standalone browser suite: 29 of 29 in 9.4 minutes.
- [x] 3.4 `openspec validate the-sweep-finishes-the-archive-it-opened
  --strict`: valid. The merge gate locally with `--base origin/main`: ok.
- [x] 3.5 A changeset: core, the server and the extension, patch.

Found while reading the audit log for something else. `grep` reported
`Binary file packages/core/src/change-cost-report.ts matches` — a source
file, in a repository that greps itself constantly.

## 1. The fix

- [x] 1.1 Write the separator as an escape. The runtime value is
  unchanged; this is about the bytes on disk.
- [x] 1.2 Change nothing about the key or how rows are paired. It works,
  and its collision argument is sound.

## 2. The check

- [x] 2.1 A repository check that no tracked source file carries a raw
  control byte, run alongside the English-policy and test-budget checks
  that already guard the same class of thing.
- [x] 2.2 It reads git's own file list, like `check-english.mjs` does —
  a scan of the working tree would trip over build output and caches.
- [x] 2.3 It names the file and the offset. "Something is wrong
  somewhere" costs whoever reads it the search this check exists to make
  possible.
- [x] 2.4 Show it can fail: reintroduce the byte, confirm the check
  reports it with its offset, and restore. Record what it said.
  Done 2026-09-08:
  `packages/core/src/change-cost-report.ts:102 contains a raw control
  byte 0x00 at offset 4517`. File, line and offset — enough to go
  straight to it, which was the whole complaint about the symptom that
  started this.

## 3. Verification

- [x] 3.1 `openspec change validate --strict source-stays-text`.
  Run 2026-09-08: valid.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean with no
  warnings, now including the new check. Tests 48 cli, 710 core, 304
  extension, 62 server, 296 webui — unchanged, as a change that alters
  one byte and adds a repository check should leave them.
- [x] 3.3 Confirm `grep` now reads the file as text — the symptom that
  started this.
  `grep -c "keyOf"` returns 3. Before, the same command returned
  `Binary file ... matches` and no count.
- [x] 3.4 No changeset: no package's behaviour changes.

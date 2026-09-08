The defect this guards against has already happened, on 2026-09-08, to
`timeout` and `maxStageAttempts` at once: added to the type, to the
accepted-key list and to the validator, and still dropped by a reader
that names its fields one by one.

## 1. The guard

- [x] 1.1 Export `TOP_LEVEL_CONFIG_KEYS` so the test reads the real set
  rather than a copy that can drift from it.
- [x] 1.2 A table from key to a representative value, and assert its own
  keys equal `TOP_LEVEL_CONFIG_KEYS` **before** looping. Without that the
  table rots: a key added to the product with no sample is a key silently
  untested, and it is the newest key — the one at risk.
- [x] 1.3 Write a configuration setting the key, read it back, and assert
  the value survived.
- [x] 1.4 Assert the same through a merge, with the key set only in the
  per-change file. `mergeHarnessConfig` names its fields one by one too,
  and the merged config is what a chain actually reads.
- [x] 1.5 A test, not a lint script — the reason the relation check is a
  test: it runs from source with nothing built, so a build that did not
  happen cannot skip it.

## 2. Verification

- [x] 2.1 `openspec change validate --strict config-keys-survive-a-round-trip`.
  Run 2026-09-08: valid.
- [x] 2.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 659 core,
  285 extension, 62 server, 267 webui — core up 15, one per key per
  reader plus the table's own completeness check.
- [x] 2.3 No changeset: a test and one export, nothing published changes.
- [x] 2.4 Show the guard can fail, which a passing test does not show on
  its own: remove one field from `readGlobalHarnessConfig` temporarily,
  confirm the test fails and names that key, and restore it. Record which
  key and what the failure said.
  Done 2026-09-08. Removed `timeout: input.timeout ?? ...` from
  `readGlobalHarnessConfig`: exactly one test failed —
  `carries "timeout" back out of the global file` — and the rest of the
  suite stayed green, so the guard is specific rather than a broad
  tripwire. Restored.
- [x] 2.5 Show the second half can fail too: remove the same field from
  `mergeHarnessConfig` and confirm the per-change assertion catches it.
  The two readers are separate code and a guard over one proves nothing
  about the other.
  Done 2026-09-08, separately. Removed `timeout: override.timeout ?? ...`
  from `mergeHarnessConfig`: the global-file assertion passed and
  `carries "timeout" through a per-change merge` failed, which is the
  point — a guard over one reader proves nothing about the other.
  Restored.

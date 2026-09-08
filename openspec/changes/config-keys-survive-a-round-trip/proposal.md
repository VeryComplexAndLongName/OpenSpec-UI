## Why

A harness setting can be written to the file, pass validation, and be
silently discarded on the way back out.

It happened on 2026-09-08, to two settings at once. `timeout` and
`maxStageAttempts` were added to `HarnessConfig`, to
`TOP_LEVEL_CONFIG_KEYS`, and to the validator — every guard the file has
— and `readGlobalHarnessConfig` still dropped them, because it builds its
result field by field and nobody added the two new lines.

The failure had no symptom at the seam. The file was correct, the write
was accepted, the read returned a valid config. What appeared instead was
a ceiling that did nothing: three tests hung for sixty seconds each,
waiting for a timeout that the resolved configuration did not contain.

The accepted-key list guards **writing** — a key it does not know is
refused outright, with a helpful message. Nothing guards reading. The
comment now beside that reader says so, which helps whoever reads it and
does not fail a build.

This is the second time this shape of defect has cost this repository
real time. `openspec change validate --strict` accepts unknown keys and
ignores them, which is why a relation naming a change that does not exist
became a test rather than a lint; the same reasoning applies here.

## What Changes

- A test that every accepted top-level key survives a write followed by a
  read.
- The test fails when a key is added to the product without a value to
  exercise it, so the guard cannot rot into a list of the keys someone
  remembered.

## Capabilities

### Modified Capabilities

- `agentic-harness`: a setting the configuration accepts is a setting the
  resolved configuration carries.

## Impact

- `packages/core/src/harness-config.test.ts`, and exporting the key list
  the test reads. No behaviour changes, so no changeset.

## Explicitly out of scope

- **Rewriting the reader to spread the parsed object.** It would fix this
  class outright and it would also stop dropping keys the validator
  rejects, which is a real property worth keeping: today a config is
  normalised on the way out, and every field present has been through a
  check. Making that change is a bigger argument than a test, and the
  test is what catches the regression either way.
- **The per-change reader.** It returns the parsed object as-is and
  cannot drop a key. Nothing to guard.

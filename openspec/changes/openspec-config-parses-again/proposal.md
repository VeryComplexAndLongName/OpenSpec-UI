# OpenSpec config parses again

## Why

`openspec/config.yaml` holds this repository's invariants and rules.
`openspec instructions` hands them to every proposal, apply and archive, and
CLAUDE.md names the file as the source of truth for them.

The file has not parsed since #364 on 2026-09-10:
- A list item under `rules.tasks` is a plain multi-line scalar containing
  `why: `. YAML reads the colon and space as a key.
- `openspec` reports "could not parse openspec/config.yaml (Implicit keys
  need to be on a single line at line 60, column 7:); ignoring it".
- It then carries on without the file.

Every check stayed green, because nothing in the repository parses the
file. Archiving `a-gh-refusal-names-its-cause` printed the warning, which
is how it was found.

## What Changes

- **`openspec/config.yaml`.** The item becomes a `>-` block scalar, as the
  versioning item under `operations.apply.guidance` already is. Its words
  do not change.
- **`scripts/check-openspec-config.mjs`**, a new lint check. It fails when
  the file does not parse or lacks `schema`, `context`, `rules` or
  `operations`, naming the line.
- **`scripts/check-openspec-config.test.mjs`.** Tests for that check,
  including one against the repository's own file.
- **`package.json`.** `lint:openspec-config` joins `lint`, and
  `test:openspec-config` joins `test`. `yaml` becomes a declared dev
  dependency: it was installed only as another package's dependency, so
  CI could not rely on it.

## Capabilities

### Modified

- `quality-gates`: the lint gate fails on an OpenSpec config that does not
  parse.

## Impact

- `openspec/config.yaml`, `scripts/`, and the root `package.json` with its
  lockfile.
- No package's behaviour changes, so there is no changeset.

## Out of scope

- **Rewording any rule.** Only the quoting changes.
- **Making `openspec` itself fail on an unparsable config.** That is the
  tool's behaviour, not this repository's.

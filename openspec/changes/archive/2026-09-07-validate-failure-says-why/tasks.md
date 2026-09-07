The reproduction is one command, and it is worth keeping: in a workspace
with a change that states no delta, `npx @openspec-ui/cli validate --cwd .`
reports the failure with no reason. Run it before the fix and after.

## 1. Read the report before the exit code

- [x] 1.1 Where a validation run exits non-zero, parse stdout first. A
  report that parses and matches the expected shape is the answer; the
  exit code adds nothing it does not already say.
  Done: the spawn wrapper resolves whatever happened instead of
  rejecting, and `runJson` takes an `acceptNonZeroExit` option.
- [x] 1.2 Keep the exit code as the signal where there is no report:
  binary missing, crash before output, output that is not the expected
  shape. Those still fail the way they fail today.
- [x] 1.3 Scope the change to validation. `listChanges`, `showChange`,
  `statusChange`, `createChange` and `archiveChange` share the wrapper
  but not the property that a non-zero exit carries a usable report, and
  design.md says why `archive` in particular is left alone.
  Done: only `validateChange` passes the option; every other caller
  keeps today's behaviour, and the option's doc comment says why.
- [x] 1.4 Do not change when `1` or `2` is produced. This changes what is
  printed alongside a `1`.

## 2. An invalid change is reported as invalid

- [x] 2.1 A change failing strict validation carries its issues and its
  counts, not an `error` string. The observed run reported
  `failedItems: 0, totalItems: 0` for the change that failed, beside
  `totalItems: 1` for one that passed.
  Verified end to end against a real workspace: a change with no delta
  now reports `failed=1/1` and the issue text, where it reported
  `0/0` and a Node warning.
- [x] 2.2 The "could not be validated" path stays for what it was written
  for — a corrupted directory, a tool that will not run — and the
  `ci-cli` specification's distinction between the two becomes true
  again.

## 3. Noise is not a diagnosis

- [x] 3.1 Prefer stdout where it carries a diagnosis; fall back to
  stderr.
- [x] 3.2 Where neither yields one, say that no diagnosis was reported
  rather than printing whatever was on stderr.
- [x] 3.3 Assert on content, not presence. The defect shipped with a
  well-formed `error` field; a test asserting one exists would have
  passed throughout. The assertion is that the reason names the change or
  its problem — a reason whose whole content is
  `ExperimentalWarning: Importing JSON modules` must fail it.
  Done: `openspec.test.ts` asserts the message names what the tool said
  and, separately, that a stream carrying only a warning yields
  "no diagnosis reported".

## 4. Tests

- [x] 4.1 A stub `openspec` that exits `1` and prints a valid report:
  the change is invalid, its issues survive, counts are populated.
  Done, plus the same case through `validateChange` itself.
- [x] 4.2 The same stub also writing a warning to stderr: the reported
  reason is the diagnosis, not the warning. This is the regression.
- [x] 4.3 A stub that exits `1` with unparseable output: reported as
  could-not-validate, and the reason says no diagnosis was reported.
- [x] 4.4 A stub that cannot be spawned at all: unchanged behaviour,
  exit `2`.
- [x] 4.5 Exit codes asserted in every case above, since the contract is
  what this change promises not to touch.

## 5. Verification

- [x] 5.1 `openspec change validate --strict validate-failure-says-why`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-07 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 604 core,
  280 extension, 62 server, 265 webui — core up 4 and cli up 2 for
  the cases added here.
- [x] 5.3 Version bump via `npx changeset` for `@openspec-ui/core` and
  `@openspec-ui/cli`.
- [x] 5.4 Reproduce the original failure end to end: point the CLI at a
  workspace whose change states no delta, and confirm the report names
  the missing delta and the `skip_specs: true` remedy. Record what it
  printed, since that string is the whole point of the change.
  Run 2026-09-07 against C:/Prog/OpenSpec-UI-Homepage, which carries a
  change stating no delta. Reported: `ban-the-scanners valid=false
  failed=1/1`, issue "Change must have at least one delta. No deltas
  found. Ensure your change has a specs/ directory with capability
  folders...". Before this change the same run reported
  `failedItems: 0, totalItems: 0` with an ExperimentalWarning as the
  whole reason.

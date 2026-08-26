## Why

After the first real `npm publish` attempt of `@openspec-ui/cli`
(`2026-08-26-prepare-cli-npm-publish`), the user tried
`openspec-ui-cli --help` to see the available options and got only
`openspec-ui-cli: unknown command '--help' (supported: validate)` — no
usage text at all. The options (`--cwd`, `--format`) were documented
only in `packages/cli/README.md` on the npm registry page, not
discoverable from the CLI itself. Any real external consumer running
this CLI for the first time hits the same gap.

## What Changes

- Add a `USAGE` string and `--help`/`-h` handling to
  `packages/cli/src/main.ts`: printed to stdout, exits `0`.
- Also print `USAGE` to stderr alongside the existing "unknown command"
  and argument-parsing error messages, so a mistake (not just an
  explicit `--help`) also surfaces the available options immediately.
- Update `packages/cli/README.md` to mention `--help`/`-h`.

## Capabilities

### Modified Capabilities

(none in the specified-behavior sense — `validate`'s own behavior and
exit-code contract are unchanged; this only adds a `--help` path and
richer error output. `.openspec.yaml` sets `skip_specs: true`.)

## Impact

- `packages/cli/src/main.ts`
- `packages/cli/src/main.test.ts`
- `packages/cli/README.md`
- `.changeset/*.md` (new changeset file)

## 1. Add --help

- [x] 1.1 Add a `USAGE` string (command syntax, `--cwd`/`--format`
  options, exit-code contract) and `--help`/`-h` handling to
  `runMain()` in `packages/cli/src/main.ts`, checked before argument
  parsing; prints to stdout and exits `0`.
- [x] 1.2 Print `USAGE` to stderr alongside the existing unknown-command
  and argument-parsing error messages.
- [x] 1.3 Update `packages/cli/README.md` to mention `--help`/`-h`.

## 2. Verification

- [x] 2.1 Add tests to `packages/cli/src/main.test.ts`: `--help` and
  `-h` print usage and exit `0`; an unknown command still exits `2` and
  now also prints usage as a second stderr line (existing assertions on
  the first stderr line are unaffected).
- [x] 2.2 `npm run typecheck`, `npm run lint`, and `npm run test`
  (workspace) pass for `@openspec-ui/cli`.
- [x] 2.3 Rebuild (`npm run build --workspace @openspec-ui/cli`) and
  smoke-test `node packages/cli/dist/cli.js --help` directly.
- [x] 2.4 Propose a changeset (`npx changeset`) for `@openspec-ui/cli`
  (patch: new flag, no breaking change) instead of hand-editing
  `version`/`CHANGELOG.md`; apply it via `npx changeset version`.
- [x] 2.5 Run `openspec change validate --strict add-cli-help-flag`.

# @openspec-ui/cli

A non-interactive CLI for using [OpenSpec](https://github.com/Fission-AI/OpenSpec)
change validation as a CI merge gate — on GitHub Actions, Gitea Actions, or
any other CI system that can run a Node.js process and check its exit code.

It requires the [`openspec`](https://www.npmjs.com/package/@fission-ai/openspec)
CLI to already be installed and available on `PATH`.

## Usage

```sh
npx @openspec-ui/cli validate --cwd . --format text
```

- `--cwd <path>`: repository root containing `openspec/changes/` (defaults
  to the current directory).
- `--format json|text`: `json` (the default) prints an aggregated report
  suitable for further processing; `text` prints a human-readable table.

## Exit codes

- `0`: every active change passed strict validation.
- `1`: at least one active change failed strict validation — an
  actionable CI failure.
- `2`: the CLI itself could not complete the check (bad arguments, the
  `openspec` CLI missing, a filesystem error) — distinct from `1` so a
  CI system can tell "your change is broken" apart from "the tooling
  itself is broken."

## Scope

This CLI intentionally supports only `validate`. See
[docs/adr/0007-ci-cli-third-delivery-target.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0007-ci-cli-third-delivery-target.md)
for why, and
[docs/adr/0009-publish-cli-to-npm.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0009-publish-cli-to-npm.md)
for why this package is published standalone rather than as part of the
OpenSpec UI monorepo's other packages.

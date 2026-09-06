# @openspec-ui/cli

A non-interactive CLI for using [OpenSpec](https://github.com/Fission-AI/OpenSpec)
change validation as a CI merge gate — on GitHub Actions, Gitea Actions, or
any other CI system that can run a Node.js process and check its exit code.

It requires the [`openspec`](https://www.npmjs.com/package/@fission-ai/openspec)
CLI to already be installed and available on `PATH`.

## Usage

### `validate` — the merge gate

```sh
npx @openspec-ui/cli validate --cwd . --format text
```

- `--cwd <path>`: repository root containing `openspec/changes/` (defaults
  to the current directory).
- `--format json|text`: `json` (the default) prints an aggregated report
  suitable for further processing; `text` prints a human-readable table.
- `--help` / `-h`: print this usage summary and exit `0`.

```sh
npx @openspec-ui/cli --help
```

### `change-graph` — what a change follows

Changes may state their relation to one another in `.openspec.yaml`:
`follows` (this change exists because that one left something),
`supersedes` (it corrected a decision that one made), and `blocked_by`
(it cannot start until that one lands). This renders the result.

```sh
npx @openspec-ui/cli change-graph --cwd .
npx @openspec-ui/cli change-graph --cwd . --change <id>
```

- `--change <id>`: print one change's ancestry — what it follows, and
  what those follow — instead of the whole graph. This is the question
  the relation exists to answer: why a decision is the way it is.
- `--all`: include changes that state no relation, which are omitted by
  default.

Archived changes are marked as such, and a change waiting on a blocker
that has not landed is shown as waiting.

### `release-manifest` — the published version set

Builds the `releases.json` a project site can read, so a release is
described in one document rather than scraped. `--fingerprint` prints
only the `id@version` set, which is how a publishing step decides whether
anything changed at all.

```sh
npx @openspec-ui/cli release-manifest --cwd . --repository <owner/name>
```

See `--help` for the full flag set.

## Exit codes

- `0`: every active change passed strict validation.
- `1`: at least one active change failed strict validation — an
  actionable CI failure.
- `2`: the CLI itself could not complete the check (bad arguments, the
  `openspec` CLI missing, a filesystem error) — distinct from `1` so a
  CI system can tell "your change is broken" apart from "the tooling
  itself is broken."

## Scope

`validate` is what this package exists for, and the exit-code contract
above applies to it: `change-graph` and `release-manifest` report rather
than gate, and exit `0` unless the arguments are wrong.

This CLI deliberately does not orchestrate agents, run changes, or edit
anything. See
[docs/adr/0007-ci-cli-third-delivery-target.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0007-ci-cli-third-delivery-target.md)
for why, and
[docs/adr/0009-publish-cli-to-npm.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0009-publish-cli-to-npm.md)
for why this package is published standalone rather than as part of the
OpenSpec UI monorepo's other packages.

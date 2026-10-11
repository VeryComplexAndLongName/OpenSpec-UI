# @openspec-ui/cli

A CLI for inspecting, validating and running [OpenSpec](https://github.com/Fission-AI/OpenSpec)
changes from a terminal or CI. Business behavior and security rules are shared
with the workbench through core; the terminal does not grant stronger permissions.

It requires the [`openspec`](https://www.npmjs.com/package/@fission-ai/openspec)
CLI to already be installed and available on `PATH`.

## Usage

### `validate changes` — the merge gate

```sh
npx @openspec-ui/cli validate changes --cwd . --format text
```

- `--cwd <path>`: repository root containing `openspec/changes/` (defaults
  to the current directory).
- `--format json|text`: `json` (the default) prints an aggregated report
  suitable for further processing; `text` prints a human-readable table.
- `--help` / `-h`: print this usage summary and exit `0`.

```sh
npx @openspec-ui/cli --help
```

### `show graph` — what a change follows

Changes may state their relation to one another in `.openspec.yaml`:
`follows` (this change exists because that one left something),
`supersedes` (it corrected a decision that one made), and `blocked_by`
(it cannot start until that one lands). This renders the result.

```sh
npx @openspec-ui/cli show graph --cwd .
npx @openspec-ui/cli show graph --cwd . --change <id>
```

- `--change <id>`: print one change's ancestry — what it follows, and
  what those follow — instead of the whole graph. This is the question
  the relation exists to answer: why a decision is the way it is.
- `--all`: include changes that state no relation, which are omitted by
  default.

Archived changes are marked as such, and a change waiting on a blocker
that has not landed is shown as waiting.

### `write manifest` — the published version set

Builds the `releases.json` a project site can read, so a release is
described in one document rather than scraped. `--fingerprint` prints
only the `id@version` set, which is how a publishing step decides whether
anything changed at all.

```sh
npx @openspec-ui/cli write manifest --cwd . --repository <owner/name>
```

See `--help` for the full flag set.

The manifest describes CLI under the stable `ci-cli` id as a public product,
with its own package version, release notes, summary and
`links.npm`: `https://www.npmjs.com/package/@openspec-ui/cli`. The homepage uses
this metadata for its Current versions tile and Current releases card.
Other products do not receive an npm link.

The version is what the repository carries; it does not prove that version is
already on npm. Registry publication is a separate, manually dispatched step.
Manifest schema version remains 1, and the npm link is optional for consumers.

## Exit codes

- `0`: every active change passed strict validation.
- `1`: at least one active change failed strict validation — an
  actionable CI failure.
- `2`: the CLI itself could not complete the check (bad arguments, the
  `openspec` CLI missing, a filesystem error) — distinct from `1` so a
  CI system can tell "your change is broken" apart from "the tooling
  itself is broken."

## Scope

`validate changes` keeps the merge-gate exit contract above. Existing
`run change`, `run checks`, `update plan`, status, coordination, task and
worktree commands remain available; see `--help` for the full list.

### Workbench commands

Every command below accepts `--cwd <repository>` and `--format text|json`.
Text is the default. Read reports are one JSON document; `run task` emits
one core event per JSON line and a final `kind: taskResult` result.

| Command | What it reports or does |
| --- | --- |
| `show changes` | Active changes across checkout/worktrees, stage, tasks and blockers |
| `show tasks <change>` | Tasks, evidence, completion and person/delegate responsibility |
| `show diff <change>` | OpenSpec artifacts against HEAD, including staged and untracked artifacts |
| `explain change-harness <change>` | Effective configuration, gates, budgets and capability facts |
| `show agents` | Registered providers/capabilities; authentication is not checked |
| `explain message <OSW-code>` | Message template, level, reason, remedy and documentation |
| `show cost <change>` | Repository-wide recorded usage, units and unmeasured runs |
| `show run <runId>` | Audit records and retained logs for the persisted runId |
| `explain change <change>` | Stage, ownership, tasks, open questions, readiness and advice |
| `send message <instanceId> "<text>"` | Queue a signed note to a live status instance |
| `run task <change> <number>` | Run one open task on its declared delegate in its own worktree |
| `rollback change <change>` | Confirmed restoration through recorded recovery checkpoints |

For these additional commands, exit 0 means a successful report/action, exit 1
means refusal, failed/cancelled task or absent requested subject, and exit 2 means
bad arguments or tooling/configuration failure. An empty report is successful.
Diagnostics go to stderr with an `OSW` identifier; JSON stdout stays parseable.

`show diff` is an artifact-only diff, not the implementation branch's complete
source diff. `show run` takes core's persisted runId, not the live instanceId
printed by `show status`; missing or truncated retained output is not reconstructed.
Cost is only recorded usage: unmeasured runs are not free, credits stay separate
from USD, and retained audit history is bounded.

Messages report a queued id, not receipt or action. An agent-marked environment
or a non-interactive sender is not promoted to human approval. The receiver's
signature/freshness/author policy still decides whether it acts on a note.
`run task` refuses ordinary/human-only tasks, uses the declared agent, holds
the mutation lease and preserves permission/cancel and recorded-evidence gates.
No successful agent process automatically ticks a task.

Rollback requires a terminal confirmation before recovery initialization.
Its journal may then be updated by core; eligible files restore only without
conflicts, under the mutation lease. Missing/incompatible checkpoints or live
writers are refused. No force or consent-bypass flag exists. A run without
captured checkpoints does not acquire rollback coverage through this command.

See
[docs/adr/0007-ci-cli-third-delivery-target.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0007-ci-cli-third-delivery-target.md)
for the delivery target, and
[docs/adr/0009-publish-cli-to-npm.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0009-publish-cli-to-npm.md)
for why this package is published standalone rather than as part of the
OpenSpec UI monorepo's other packages.

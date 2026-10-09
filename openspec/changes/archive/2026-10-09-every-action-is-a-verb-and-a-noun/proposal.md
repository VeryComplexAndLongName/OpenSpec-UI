## Why

The owner, on 2026-10-08: the Changes tree's context menu is a long list of
words with one separator, and nothing to find one's way by. The extension's
67 commands and the CLI's subcommands were named one at a time - "Run...",
"Say Something to This Run...", "It Was Me...", `doctor`, `advise`,
`send-back` - so each new one added a new pattern. ADR 0045 decides that
every action is a verb and a noun, from approved lists, the way PowerShell
names its cmdlets, and that the old names go rather than stay as aliases:
the product has 58 installs and 40 updates (2026-10-07).

## What Changes

- **BREAKING** Every extension command is renamed to `<Verb> <Noun>`, with
  the id `openspec-ui.<verb><Noun>`, the category "OpenSpec Workbench" and
  an icon of its own, which no other command shares. The table is in ADR
  0045.
- **BREAKING** Every CLI subcommand becomes a pair: `validate changes`, `run
  change`, `diagnose workspace`, `answer question`, ... A former name is
  refused with `OSW-CLI-001`, naming its replacement.
- "Validate Change (Strict)" goes: "Validate Change" is strict, and asks for
  a change when none is selected.
- `action-vocabulary.ts` in core: the verbs with their group and danger, the nouns, and how a pair is read and named. Tests hold the
  extension's manifest and the CLI's subcommands to it.
- Every message, hint and document that names a command or subcommand
  names it by its pair: the supervisor's and readiness hints, the workflow
  rules agents are given, the merge gate's own workflow, README, HARNESS.md
  and the how-to pages. Published articles and earlier ADRs keep the names
  they had.
- ADR 0045 is amended where carrying it out showed two gaps: the three
  "Clear Filter" commands are told apart (Clear Archive Filter, Clear Specs
  Filter, Clear Graph Filter), and the nouns gain Archive, the three
  filters, Changes and Change Copy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vscode-extension`: commands are a verb and a noun; the commands that
  named them before are renamed.
- `ci-cli`: subcommands are a verb and a noun; former names are refused.
- `agentic-harness`, `command-output-hub`, `openspec-workbench`:
  requirements that name a command or subcommand name it by its pair.

## Impact

- `packages/core`: `action-vocabulary.ts`; hints and messages naming CLI
  subcommands.
- `packages/extension`: `package.json`, every command registration and its
  tests.
- `packages/cli`: `subcommands.ts`, `main.ts`, messages and tests.
- `.github/workflows/quality.yml`, `.gitea/workflows/quality.yml`: the
  merge gate and the release manifest steps use the new subcommands.
- Documentation as above. A changeset for core, extension, cli, webui,
  server.

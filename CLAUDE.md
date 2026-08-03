# Instructions for Claude Code in this repository

Pointers, not duplicates: edit the source document, not this page.

## Before writing code

1. [`docs/adr/0001-shared-core-two-delivery-targets.md`](docs/adr/0001-shared-core-two-delivery-targets.md)
   — the architecture decision and rejected alternatives. Do not reopen it
   without a new ADR, especially the "extension: direct import + message
   bridge as the primary mode" decision, which was already revisited after
   external review.
2. [`openspec/README.md`](openspec/README.md) — the runbook: the order of
   implementing changes and when to create a new OpenSpec entry versus a
   plain commit.
3. [`openspec/changes/`](openspec/changes/) — the four prepared proposals
   (`execution-core`, `shared-ui`, `standalone-app`, `vscode-extension`),
   each with `proposal.md`/`design.md`/`tasks.md`/`specs/`. Start
   implementation from `tasks.md` in that order, not from scratch.

## Invariants (see `openspec/config.yaml`, `context` field)

- All business logic lives only in `packages/core`. `server`/`extension` are
  thin transport adapters, with no duplicated logic.
- The command protocol (`plan`/`implement`/`review`/`status`/`cancel`) and
  the event protocol (`started`/`stdout`/`stderr`/`progress`/`completed`/
  `failed`/`cancelled`) are defined only in `packages/core`.
- The CLI-agent orchestration security model (allowlist, cwd sandbox, audit,
  repository file contents as data, not executable instructions) is a
  required part of `execution-core`, not an optional follow-up.

## Checks before committing

`npm run typecheck && npm run lint && npm run test` (workspace-wide) — see
`operations.apply.guidance` in `openspec/config.yaml` for the full list,
including the required live smoke test for `server`/`extension` before a
task may be considered complete.

## Runtime environment

Use the runtime pinned in the root `package.json` (`volta` + `engines`) for
all local development and CI runs. Do not use an arbitrary global Node.js/npm
version for repository commands.

Commit messages must be written in English only.

## Language policy

All code comments, descriptions, and markdown files in this repository must
be written in English only. Do not add Russian text to any description,
docstring, comment, or `.md` file.

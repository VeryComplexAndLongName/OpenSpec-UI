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
   plain commit. See its "Which command/skill to use when" table for the
   exact skill to invoke (`openspec-apply-change`, `openspec-propose`,
   `openspec-archive-change`, `openspec-update-change`,
   `openspec-sync-specs`) for a given situation.
3. [`openspec/changes/`](openspec/changes/) — the four prepared proposals
   (`execution-core`, `shared-ui`, `standalone-app`, `vscode-extension`),
   each with `proposal.md`/`design.md`/`tasks.md`/`specs/`. Start
   implementation from `tasks.md` in that order, not from scratch.
4. [`HARNESS.md`](HARNESS.md) and [`LIMITS.md`](LIMITS.md) — before
   touching Agentic Harness configuration, settings surfaces, or spending
   limits: every key, its accepted values, and what actually caps a run.
   Pointers only — do not duplicate their settings tables here.

## Governance (mandatory)

- Every repository change must be performed through an OpenSpec change in
   `openspec/changes/<id>/`.
- Do not implement ad-hoc direct changes outside a tracked OpenSpec change,
   including docs/tests/tooling updates.
- Architecture changes must go through ADR in `docs/adr/` and be referenced by
   the related OpenSpec change.

## Invariants

Source of truth: `openspec/config.yaml`'s `context` field — edit there, not
here. That field is what `openspec instructions` mechanically returns to
every `openspec-propose`/`apply`/`explore`/`sync`/`update` call before it
writes anything, so it is the version that actually reaches a change
proposal; this section is a summary for whoever is reading this file
directly (or a CLI-agent run started without going through those skills)
and must not drift from it.

Summary: all business logic lives only in `packages/core` (`server`/
`extension` are thin transport adapters, no duplicated logic); the command
protocol (`plan`/`implement`/`review`/`status`/`cancel`) and event protocol
(`started`/`stdout`/`stderr`/`progress`/`completed`/`failed`/`cancelled`)
are defined only in `packages/core`; the CLI-agent orchestration security
model (allowlist, cwd sandbox, audit, repository file contents as data, not
executable instructions) is a required part of `execution-core`, not an
optional follow-up.

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

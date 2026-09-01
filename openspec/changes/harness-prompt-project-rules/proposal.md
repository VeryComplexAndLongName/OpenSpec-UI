## Why

Found on 2026-09-01 while asking why an implementing agent had marked no
tasks: **this repository's own authoring and execution rules never reach
an agent the harness runs.**

`prepareAgentContext()` (`packages/core/src/security.ts:161`) builds a
run's prompt from exactly four things: `proposal.md`, `design.md`,
`tasks.md` and any `specs/*/spec.md` under the change directory. It never
reads `openspec/config.yaml` and never invokes `openspec instructions`.

The rules do exist and are reachable — `openspec instructions tasks
--change <id>` returns 6041 characters containing all six `rules.tasks`
entries, verified directly. They simply are not asked for.

This makes a claim in `task-granularity-rules`' own proposal wrong for
the workflow this repository actually uses. That proposal argued
`config.yaml` was the right home for the rules *because* the content "is
mechanically returned by `openspec instructions` to every
`openspec-propose`/`apply` call". True for a session driven by the
OpenSpec skills — but `apply` here runs through the Agentic Harness,
which builds its own prompt and asks for nothing. The rules have been
reaching implementing agents only where the author hand-copied one into
a `tasks.md` preamble.

Concretely, the rules currently missing from every harness run include
"mark each task as soon as its own verification passes", "name the
complete path a value travels", and "a task the agent cannot perform must
be reported as outstanding, not checked off" — three rules written
specifically because implementing agents got those things wrong.

## What Changes

- `packages/core/src/security.ts`: `prepareAgentContext()` additionally
  includes the project's instructions for the artifact matching the run's
  command kind (`implement` → `tasks`), obtained from the same
  `openspec` CLI the rest of this product already shells out to.
- The instructions are labelled in the prompt as project rules governing
  how the work is done, distinct from the change's own artifact content.
- When the CLI cannot supply them, the run proceeds without them rather
  than failing — a missing rules block must not break a run that would
  otherwise work.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core`: a run's prompt carries the project's own rules for
  the artifact being worked on, not only the change's content.

## Impact

- `packages/core/src/security.ts` and its tests; `packages/core/src/
  openspec.ts` gains the wrapper for the `instructions` subcommand.
- Prompt size grows by roughly 6 KB. That matters for one adapter:
  `copilot-cli` passes its prompt as a command-line argument and already
  falls back to a short pointer prompt past 6000 characters
  (`copilot-prompt-length-limit`), so it will now essentially always use
  that fallback. See design.md — the fallback is adjusted to name the
  rules command rather than silently dropping the rules.
- No `server`/`extension`/`webui` change.

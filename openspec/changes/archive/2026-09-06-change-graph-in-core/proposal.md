## Why

`change-dependency-graph` put the reader for `follows`/`supersedes` in
`scripts/check-change-graph.mjs`, deliberately: the CLI is compiled and
published while `scripts/` runs before any build with no dependencies, so
a command there would have meant a second copy of the parser.

That reasoning holds for a repository-only tool and fails the moment the
VS Code extension needs the same data. The extension runs in someone
else's workspace, where this repository's `scripts/` do not exist, and it
must read *that* workspace's `openspec/changes` itself. The repository's
own invariant says where the reader belongs: all business logic lives in
`packages/core`, with `server` and `extension` as thin adapters.

Moving it raises the question the first change dodged. `packages/core`
exports TypeScript source directly, so a plain `node scripts/*.mjs`
cannot import it, and making `npm run lint` depend on a build would tie
the fastest gate in the repository to the slowest step.

It does not have to. **Vitest runs TypeScript directly, and this
repository already has tests that read its own `openspec/` tree** —
`harness-config.test.ts` has "still loads every harness.json under
openspec/changes", and `task-checklist.test.ts` has "parses every real
tasks.md without throwing". A test in `core` is a gate that needs no
build, no second parser, and no new script.

There is also a relation the first change left out, and the omission was
recorded as a decision: `blocked_by` was not added because "no instance
exists — all twelve active changes are independent". That is no longer
true. The three changes planned after this one cannot start before it
lands, and the question being asked of the graph has changed from "why is
this decision here" to "what can I start now".

The two are not the same relation and should not share a key. `follows`
is history and never resolves; `blocked_by` is a schedule and resolves
the moment the blocker is archived. A cycle in the first is a confused
record; a cycle in the second is a deadlock.

## What Changes

- The reader moves to `packages/core`, typed, exported, and covered by
  its own unit tests.
- `blocked_by` joins the two existing keys: a list of change ids that
  must land before this change can start.
- The gate becomes a test in `core` that reads this repository's own
  `openspec/changes`, replacing `scripts/check-change-graph.mjs` and
  `npm run lint:change-graph`. No build coupling, one implementation.
- `scripts/change-graph.mjs` keeps rendering for the terminal, reading
  through the same core module — it is the one caller that can afford a
  build, because it is not a gate.

## Capabilities

### Modified Capabilities

- `quality-gates`: the relation check no longer needs a second parser or
  a build, and covers a blocking relation as well as a historical one.

## Impact

- New module and tests in `packages/core`; `scripts/check-change-graph.mjs`
  removed and `scripts/change-graph.mjs` rewired; root `package.json`
  scripts. Changeset needed: `@openspec-ui/core` gains exported API.

## Explicitly out of scope

- **The VS Code surfaces.** `change-graph-in-vscode` owns those and is
  blocked by this change, which is the first real use of the key this
  change adds.
- **Making `blocked_by` fail a build while the blocker is open.** It
  states a plan, and a plan being unfinished is not an error. Reporting
  it is the renderer's job.
- **Backfilling `blocked_by` anywhere in the archive.** It describes work
  not yet started; on finished work it would be invented.

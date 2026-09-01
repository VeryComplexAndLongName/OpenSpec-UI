## Why

Reported from live use on 2026-09-01: the agent picker showed
`GitHub Copilot CLI (not detected)` repeatedly, on a machine where
`copilot` is installed and works — the same binary had just completed a
30-tool-call session successfully.

Measured on that machine, while a harness run was loading it:

| probe | run 1 | run 2 | run 3 | detection budget |
|---|---|---|---|---|
| `copilot --version` | 6.51 s | 4.96 s | 5.47 s | **3 s** |
| `claude --version` | 1.61 s | 2.72 s | — | 3 s |

`detectCliAgent` (`packages/core/src/agent-detection.ts:14`) spawns
`<executable> --version` and calls `child.kill()` after
`SPAWN_TIMEOUT_MS = 3000`, resolving `false`. A Node-based CLI resolved
through a Windows `.cmd` shim does not reliably start inside that budget,
so a present, working CLI is reported as absent.

Two things make this worse than a cosmetic annotation bug:

1. `claude --version` measured 2.72 s — inside the budget, but only
   just. The same false negative is one busy machine away from hitting
   the one agent that currently works here.
2. The label is actively misleading. This repository has just spent
   considerable effort diagnosing genuine `copilot-cli` failures; an
   incorrect "not detected" invites the conclusion that the CLI is
   missing or broken when the probe simply gave up early.

Detection is deliberately presence-only and never disables an option
(`openspec/specs/standalone-app/spec.md`, "Standalone shell can report
which agents are detected"), so nothing is blocked by this — but the
annotation it exists to provide is wrong.

## What Changes

- `packages/core/src/agent-detection.ts`: raise `SPAWN_TIMEOUT_MS` from
  `3000` to `10000`, with a comment recording the measurements above so
  the number is not later "tidied" back down as arbitrary.
- No change to the parallel structure, to `detectLocalLlm`'s separate
  `HTTP_TIMEOUT_MS`, or to what "detected" means.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core`: agent presence detection no longer reports an
  installed CLI as absent merely because it is slow to start.

## Impact

- `packages/core/src/agent-detection.ts` and its tests.
- No `server`/`extension`/`webui` change: both delivery targets call
  `detectAvailableAgents()` and render whatever it returns.

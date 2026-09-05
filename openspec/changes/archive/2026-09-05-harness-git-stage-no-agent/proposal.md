## Why

`HARNESS.md` names this defect and has nowhere to point:

> **`stepAgents.git` is accepted by this schema, and both UIs offer an
> agent picker for it — but it is never read.**

That is accurate. `HarnessChainRunner`'s `runStage` routes the `"git"`
stage straight to `runGitStage`, its own push / pull-request / merge
sequence. `CHAIN_STAGE_COMMAND` maps only `propose`, `review`, `apply` and
`verify` to a `CommandKind`; there is none for `git`, and no CLI agent
runs during that stage under any configuration. Nothing anywhere reads
`stepAgents.git`.

It is the same defect `harness-mechanical-checks` removed for `archive`,
left behind for a mechanical reason: when that change narrowed
`HarnessStepAgents` to `Exclude<HarnessStage, "archive">`, the `git` stage
did not yet exist in `CHAIN_STAGES`. Both landed in the same pull request
(#179), and `git` slipped between them.

The visible cost is a picker on the settings screen — confirmed in the
generated screenshot — offering five agents for a stage that will never
consult the answer. A user who selects one has configured nothing, is told
nothing, and has no way to discover it except by reading
`harness-chain-runner.ts`.

Documenting it was the right first move: a known defect stated plainly
beats one discovered during a run. But a document is not a fix, and a
defect described in prose with no tracked change is how it becomes
permanent.

## What Changes

- `packages/core/src/harness-step-agent.ts`: `HarnessStepAgentStage`
  excludes `git` as well as `archive`. Both are stages that run; neither
  invokes an agent.
- `packages/core/src/harness-config.ts`: a configuration setting
  `stepAgents.git` is **read**, that entry dropped with a warning naming
  the file, and the rest honoured — the same treatment `archive` already
  gets, and for the same reason: it used to be accepted, so it must not
  become a file that fails to load.
- Both settings surfaces render `git` the way they already render
  `archive`: present in the stage list, with no agent, effort or budget
  control.
- `HARNESS.md`'s `stepAgents.git` warning is replaced by the same
  sentence `archive` carries.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness`)

### Modified Capabilities

- `agentic-harness`: a stage that invokes no agent offers no agent
  setting, for every such stage rather than for one of them.

## Impact

- `packages/core/src/harness-step-agent.ts`,
  `packages/core/src/harness-config.ts` and their tests.
- `packages/webui/src/components/HarnessSettingsView.tsx` and
  `packages/extension/src/commands.ts`: `git` joins `archive` on the
  no-controls path. Both already have that path, so this adds a case
  rather than a mechanism.
- `HARNESS.md`.

## Explicitly out of scope

- Changing what the `git` stage does, or how it is gated. ADR 0014
  settled that, and `agentic-harness-git-stage` implemented it.
- Removing `git` from the stage list in either surface. It runs; hiding
  it would misrepresent the chain — the same reasoning
  `harness-mechanical-checks` task 4.4 applied to `archive`.

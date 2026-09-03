## Why

Raised directly in a repository conversation on 2026-09-02, from two
questions about this configuration:

```json
"apply": { "agent": "claude-cli", "dispatch": "vscode-chat" }
```

**Why name an agent that is never used?** Because `agent` is a required
field of the object form, and the validator demands a known agent id. But
under `dispatch: "vscode-chat"` no process is spawned at all — the
stage's prompt goes to VS Code's chat. So a user must name an agent that
is then ignored, and there is no way to express "this stage is dispatched
to chat" without inventing one.

**Can `effort` be used with it?** It can be *written*, and it does
nothing. The validator checks `effort` against the **agent** —
`claude-cli` accepts effort, so the entry passes — and never against the
**delivery mode**, which builds no argv for the flag to reach. The same
holds for `model` and `budget`. A user sets `"effort": "high"`, pays for
a run that had no elevated effort, and is never told.

That is the exact failure this repository already forbade. ADR 0019 and
`harness-step-effort-and-budget`'s task 2.2 both state that a setting an
agent cannot honour must be **refused, never ignored** — the rule was
written and this case slipped past it, because the check compares the
setting to the agent and not to how the stage is delivered.

A third gap surfaced while confirming those two: **unknown keys are
silently accepted.** `assertValidStepAgents` reads `agent`, `model`,
`dispatch`, `effort` and `budget` by name and never rejects anything
else, so `{ "agent": "claude-cli", "modle": "claude-opus-5" }` validates
and runs with the default model.

All three belong to one family this repository has now cleared five times
in a week — `stepAgents.archive` offering an agent nothing reads,
`commandInstruction("review")` describing an implementation that does not
exist yet, `AiPanel`'s header promising a cancel control it did not have,
"Cancel Process" cancelling a different kind of process, and the README
listing four agents it never had. A configuration that presents itself as
effective and is not costs someone an investigation every time.

## What Changes

- `packages/core/src/harness-step-agent.ts`: dispatching a stage to VS
  Code's chat becomes an **agent id** rather than a field beside an agent
  that is then ignored. `dispatch` as a separate key is retired.
- `packages/core/src/harness-config.ts`: a stage entry naming a parameter
  its agent has no use for is **refused** — including every parameter
  when the stage is dispatched to chat, where none of them can reach
  anything.
- Same file: an entry carrying a key the schema does not define is
  refused, naming the unknown key and listing the accepted ones. A
  misspelled parameter must not read as an omitted one.
- `openspec/agent-harness.json` and both settings surfaces follow the new
  shape; existing configurations using `dispatch` are migrated rather
  than rejected.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness`)

### Modified Capabilities

- `agentic-harness`: chat dispatch is selected as an agent; a stage
  entry's every key and value is validated against what that selection
  can actually honour, and an unrecognized key is an error.

## Impact

- `packages/core`: `harness-step-agent.ts`, `harness-config.ts`,
  `default-runners.ts`'s allowlist keying, and the extension's dispatch
  path which reads `dispatch` today.
- `packages/webui`, `packages/extension`: the stage settings surface.
- `openspec/agent-harness.json` here, plus any workspace using
  `dispatch`.

## Explicitly out of scope

- Changing what chat dispatch **does** — ADR 0016 settled that: assisted
  only, VS Code only, `handedOff` and never `completed`. This changes how
  it is named and validated, not how it behaves.
- `stepAgents.archive`, which `harness-mechanical-checks` removes for its
  own reason — a mechanical stage offering an agent — and which this
  change deliberately does not race.
- Validating `autonomyLevel`, `reviewGate` or `checkpoints` beyond what
  they already enforce.

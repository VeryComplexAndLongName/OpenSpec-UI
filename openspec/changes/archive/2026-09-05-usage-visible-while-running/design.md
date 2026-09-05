# Design

## Load-bearing facts

Established by reading the code, not assumed:

- **Every stage of a chain publishes under one `runId`.**
  `HarnessChainRunner.runStage` builds `stageCommand` with the chain
  command's own `runId`, and forwards the runner's events outward
  unchanged (`harness-chain-runner.ts`). A subscriber filtering by
  `runId` therefore already receives every stage's events, including
  `usageReported` and the `agentUpdate` carrying `usage_update`.
- **A stage is announced only when it ends.** `stageCompleted` and
  `checkpoint` both carry `{ stage, nextStage }` and are yielded *after*
  the stage finished. Nothing announces a stage starting.
- **`usageReported` arrives once per stage run, at its end.** Both
  producers (`AcpSessionDriver`, `claude-cli-acp`) emit it when their
  agent's turn is over, because that is when the vendor reports a total.
- **`usage_update` arrives during a run**, carrying `used` / `size` and an
  optional cumulative `cost` — forwarded today as an `agentUpdate` and
  rendered by every surface as the string `agent update: usage_update`.

## Decisions

### 1. `stageStarted` is a new event, not an inference

Inferring the running stage from the boundary events already emitted
fails in the two cases that matter most:

- the **first** stage has no preceding boundary, so the first stage's
  usage — often the largest — has no stage to attribute it to;
- a chain that **stops mid-stage** (failed, cancelled, or refused at the
  ceiling) never emits that stage's boundary, so the stage that actually
  spent the money is exactly the one never named.

`stageStarted { stage, agentId }` is emitted immediately before each
stage begins, including `archive` and `git` (which have no agent —
`agentId` is `""` there, reusing the same convention `checkpoint`'s
`nextAgentId` already established). It is non-terminal and carries no
decision: a surface that ignores the kind behaves exactly as it does
today, which is the property `agentUpdate`, `cancelling` and
`usageReported` were each added under.

### 2. The display accumulates from the event stream, not from the audit log

"Live" means before the run ends, and an audit entry does not exist until
the run ends — `agent-runner.ts` writes it in its `finally`. Polling the
audit log would show a stage's cost only once the stage was already over,
which is the state this change exists to improve on.

The audit log stays the source of truth for **enforcement**.
`checkBudget` is untouched. The consequence to accept honestly: the
displayed total and the enforced total are computed from two different
places and can differ for the duration of one stage. They are labelled
accordingly rather than reconciled — see decision 4.

### 3. In-flight figures are shown, and kept separate from settled ones

An ACP `usage_update` is the only thing that moves *during* a stage, and
showing it is the whole of "watch the cost while it works". But it is not
the same kind of number as a settled report:

| | Settled (`usageReported`) | In-flight (`usage_update`) |
| --- | --- | --- |
| When | Once, at a stage's end | Repeatedly, during a stage |
| Tokens | Consumed by the run | `used` = **occupied context**, falls after a compaction |
| Cost | The vendor's total for the run | The vendor's running total |
| Counts toward the ceiling | Yes | No |

So the panel renders them in separate places with different labels, and
never adds `used` into a token total. This is the same distinction
`usage-from-acp` drew when it refused to record `used` as consumption;
displaying it is safe precisely because the display is not enforcement.

`claude-cli-acp` sends no in-flight usage — its figure arrives with the
`result` line — so its stages update at stage boundaries. This is stated
in the UI's own wording rather than left for a user to infer from a panel
that does not move.

### 4. The ceiling is shown, and shown as what it is

The panel displays the configured `budget.maxCostUsd` / `maxTokens`
beside the recorded total, and says which figure the ceiling is compared
against. It does not re-implement `checkBudget`, does not stop anything,
and does not colour the in-flight figure as "over budget" — a stage
already running is never interrupted by the ceiling (ADR 0018 decision
7), so an in-flight figure crossing it means "this stage will be the
last", not "this stage is about to be stopped".

### 5. Currencies are not summed together

`AgentUsage` carries `costUsd` and, separately, `cost: { amount,
currency }` for anything else — the split `usage-from-acp` introduced
rather than converting at an invented rate. The display keeps that split:
a USD total, and any other currency listed under its own code. A chain
whose stages ran on different agents in different units shows two figures
and no third invented one.

### 6. Colour marks stage state, not spending

Stages are coloured by what happened to them — running, completed,
failed, not reached — using the class convention the event log already
uses (`openspec-event--<kind>`). Colouring by cost was rejected: the
thresholds would be invented here, and a "red" stage would mean something
different in a repository with a $5 ceiling than in one with none.

## Rejected alternatives

- **Polling `/api/usage` (or the audit log) on a timer.** Shows nothing
  until a stage ends, adds a second source of truth for a number the
  stream already carries, and would need a new endpoint in both delivery
  targets. Rejected for decision 2's reason.
- **Summing `used` across stages as "tokens so far".** It is context
  occupancy: it falls after a compaction and would present a long,
  compacting run as having spent less than a short one.
- **Converting non-USD costs into USD for one headline number.** The
  exact conversion this project has twice refused to invent (see
  `LIMITS.md`, "Why there is no single `budget: number`").
- **Enforcing the ceiling on in-flight figures, to stop a stage sooner.**
  Contradicts ADR 0018 decision 7 and would give two enforcement paths
  disagreeing about the same run.

## Open questions

- Whether the VS Code panel should surface the same summary, or link to
  it. This change puts it in `packages/webui`, which both delivery
  targets render; no extension-only work is planned, but the panel's
  width in the sidebar may want a denser layout than the standalone app.

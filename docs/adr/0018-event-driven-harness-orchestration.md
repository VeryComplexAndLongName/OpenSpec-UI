# ADR 0018: Event-driven harness orchestration

Status: Accepted

Date: 2026-09-01

## Context

`HarnessChainRunner` today runs a **linear** sequence: `CHAIN_STAGES.slice(
CHAIN_STAGES.indexOf(startStage))` over `["propose", "review", "apply",
"archive"]`. Each stage is a child process. Its completion is observed by
`child.on("close")` pushed into a queue that an async generator awaits
(`packages/core/src/agents/shared.ts`), and turned into `completed`/`failed`
per ADR 0012's terminal-event contract. There is no polling and no file
watching anywhere on that path — a point worth recording, because it is the
alternative most often assumed.

Several orchestration primitives already exist and are load-bearing:

- `WorkbenchProcessScheduler` holds a real queue (`private readonly queue:
  string[]`, `drain()`), a single mutation lock, and a listener set exposed
  as `onDidChange` — an event bus in embryo.
- `WorkbenchRunJournal` persists process state across restarts.
- `WorkspaceLeaseManager` (ADR 0010) extends the mutation lock across hosts.

Five gaps were established by direct investigation during the conversation
that produced this ADR:

1. **No stage reviews the implementation.** `review` sits at position 2,
   before `apply`, so it reviews a proposal. Yet
   `commandInstruction("review")` reads "Review the current implementation
   of the change described below against the specification" — at position 2
   there is no implementation. Both readings live in the codebase at once.
2. **No state for waiting on an external system.** `WorkbenchProcessState`
   is `queued | running | completed | failed | cancelled | interrupted |
   rolled-back`. A stage that must wait on CI can only block, holding the
   mutation lock for minutes while doing nothing.
3. **The chain cannot go backwards.** `slice()` admits no edge back to an
   earlier stage, so a reviewer that finds unfinished work has nowhere to
   send it.
4. **A change carries no scheduling metadata.** `HarnessConfig` has exactly
   four fields (`stepAgents`, `autonomyLevel`, `reviewGate`, `checkpoints`)
   — nothing expresses "start this automatically", or "only after that
   change".
5. **The reviewer-to-architect loop is already needed, and is run by
   humans.** On 2026-09-01, review of `harness-prompt-project-rules` found
   the design's premise wrong: it had treated the instructions CLI
   returning "more than a verbatim dump of the YAML" as a benefit, when
   that extra content was an instruction to author the artifact. The fix
   went back to `design.md` and the spec delta and added tasks 6-8. The
   implementation had passed every task and every test; nothing mechanical
   would have caught it.

## Decision

### 1. Orchestration is event-driven, and the bus is in-process

The existing scheduler, listener set and journal are extended into a
durable, change-level event bus. Stage transitions, suspensions and
completions are events; consumers subscribe.

External systems with no callback to us (GitHub Actions, chiefly) are
polled by an isolated async task that owns no lock and emits events on a
change of state. Polling remains at that boundary — it cannot be removed
without a webhook and a public address — but nothing waits on it while
holding the mutation lock.

### 2. Stages gain a suspended state

A stage may suspend, releasing the mutation lock, and resume on a named
event. Its first consumers are the `git` stage (ADR 0014) waiting on CI,
and any stage waiting on an external result. A suspended stage is durable:
it survives a host restart the same way an interrupted run already does.

### 3. A stage has three outcomes, not two

`completed` and `failed` are joined by **`needsRedesign`**: the work was
carried out correctly and the thing asked for was wrong. Per ADR 0012's
terminal-event contract, this is distinct from both — reporting a redesign
as `failed` would make retry logic retry the wrong thing, and reporting it
as `completed` would archive a change that cannot be built as specified.

### 4. The chain becomes a graph, with one edge that is always human-gated

`apply ⇄ verify` may loop **autonomously**, bounded by an explicit
iteration cap, after which the chain terminates in a state that requires a
human.

The edge back to `propose` **always** surfaces to a human, at every
autonomy level, including `autonomous`.

The two loops are not the same kind of act. Re-running `apply` executes a
plan that was already agreed. Re-running `propose` changes **the agreement
itself** — what we decided to build. An agent permitted to do that silently
can redefine the task and then report success against its own new
criterion, and no downstream check would notice, because every artifact
would be internally consistent. Scope belongs to the human; execution does
not have to.

### 5. Change-level scheduling, by queue rather than broadcast

`harness.json` gains scheduling metadata (an autostart policy and change
dependencies). When a change completes, the scheduler re-evaluates which
queued changes are now unblocked.

Broadcast is not used for this: a dependent change is **not running** when
its dependency finishes, so there is no subscriber to receive the message.
Making a broadcast durable enough for absent subscribers reconstructs a
queue, and we already have one.

### 6. ACP stays on the southbound boundary

ACP (ADR 0013) is the protocol for talking to **one agent in one session**.
It is not the orchestration bus and carries no orchestration vocabulary.
The two layers stay separate, which also insulates orchestration from a
protocol this project does not own and whose churn ADR 0013 already
records as a risk.

### 7. Budget is enforced at stage boundaries

Token/cost budgets (`agent-usage-accounting`) gate the **start** of a stage
and the **continuation** of a chain. They cannot abort a run in flight,
because vendor cost arrives in the run's final result message. This limit
is stated rather than papered over.

## Rejected Alternatives

**An external message broker (Redis, NATS, or similar).** Rejected on four
counts. (a) *Idempotency*: a broker delivers at-least-once, and these
stages are not idempotent — a repeated `apply` applies twice, a repeated
`archive` is destructive. (b) *Durability already exists*:
`WorkbenchRunJournal` survives restarts; a second store would drift from
it. (c) *Debuggability*: the two worst defects this project has had
(`harness-step-models`, `harness-prompt-project-rules`) were found by
reading a linear path; distributed tracing is a real cost against that
history. (d) *Deployment*: this ships as a VS Code extension and a local
server, and the project's posture is that heavy things are never bundled
(ADR 0013 rejected an npm dependency over a ~20 MB binary). At the scale
worktrees, one machine and API cost actually permit — single digits of
concurrent units — an in-process bus over the existing queue *is* the
broker, minus the operations.

**Broadcast instead of a queue for completion fan-out.** Rejected — a
broadcast has no memory, and the dependents are precisely the changes that
are not yet running. See decision 5.

**ACP as the orchestration protocol.** Rejected — layering error. ACP is
client-to-agent within one session; it has no addressing, no subscribers,
and no notion of work that outlives a session.

**Polling or file-watching to learn a stage finished.** Rejected as
unnecessary: the parent already owns the child's pipe, and
`child.on("close")` is an OS callback. Recorded here because it is the
mechanism most often assumed to be in use.

**Letting the `propose` loop run autonomously under `autonomous`.**
Rejected — see decision 4. This is the boundary at which an agent would
begin choosing what to build rather than how, and it is the same boundary
`rules.tasks` draws when it says a blocking pause is expressed through
`autonomyLevel` rather than through task text.

**Aborting a run mid-flight when a budget is exhausted.** Rejected for the
first version — it requires parsing incremental token deltas from a
streaming format, which is exactly the drift-exposed level 3 of ADR 0017.
Stage-boundary enforcement is honest about what it guarantees.

## Consequences

- `WorkbenchProcessState` gains a suspended state; the journal persists it;
  recovery must handle it, as it already handles `interrupted`.
- The chain runner stops being a `slice()` over an array and becomes a
  small state machine with an iteration counter.
- A new terminal-ish outcome (`needsRedesign`) must be handled by every
  consumer that branches on terminal kind — the same widening ADR 0012 and
  `harness-stage-dispatch` already performed for `checkpoint`,
  `stageCompleted` and `handedOff`.
- `HarnessConfig` gains scheduling fields; per the pattern established for
  `autonomous` and `agent-sufficient`, anything that *raises* a limit or
  widens authority is per-change only and never silently inherited.
- Batch processing becomes the scheduler running with more than one change
  admitted, once worktrees isolate their filesystems (ADR 0004 decision 4).
  It must not precede budget enforcement.
- Related OpenSpec changes: `harness-verify-stage`,
  `harness-suspendable-stage`, `harness-review-loop`,
  `harness-change-scheduler`, and `agent-usage-accounting` for the budget.

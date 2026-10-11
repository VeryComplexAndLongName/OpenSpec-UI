# Design

## Context

`packages/cli/src/subcommands.ts` has none of the twelve proposed pairs.
All pairs exist in `ACTION_VERBS` and `ACTION_NOUNS`. CLI handlers adapt core;
they must not reproduce core's security or business decisions.

The first six suggestions and the six subsequent workflow commands are owned
by this single change. Implement inspection first, then messaging/delegation,
then recovery, with separate focused checks before proceeding between slices.

## Goals

Give terminal users the existing workbench facts and operator actions with
stable identifiers, explicit scope and machine-readable results.

## Non-Goals

Changing existing command names, adding aliases, granting a stronger autonomy
level, forcing rollback, closing human-only tasks through an agent, reading
other repositories, exposing secrets, reconstructing deleted logs, showing
unrecorded usage as free, or removing Core from the website.

## Decisions

### Routing and output

Add the twelve exact public pairs to `SUBCOMMANDS`; internal handler names
remain private. All commands accept `--cwd` and `--format text|json`, default
text. Reports are one JSON document; `run task` JSON is newline-delimited
core events followed by a distinguishable terminal result. Diagnostics go to
stderr and carry registered identifiers; stdout remains parseable.

Exit 0 means the request was answered, queued or completed; exit 1 means a
policy/action refusal, failed/cancelled task or absent requested change/run;
exit 2 means invalid arguments or inability to read/execute the tooling.
Valid empty lists, no recorded spend, and empty diffs are successful reports.
Unknown message code is an argument error (2). Do not change existing exits.

Rejected: generic `show` dispatch with ambiguous nouns or renamed aliases,
which defeats ADR-0045 and changes the current contract.

### Shared readers and effective configuration

`show changes` and `explain change` use core workspace/stage/readiness/history
readers. Reuse the worktree-aware listing used by existing CLI stages/readiness;
do not silently omit a change that exists only in its registered worktree.
Use `readChangeTaskRows` for tasks, preserving its source/path and refusal facts.
Use core readiness/advice to derive next actions, not invented stage transitions.
Resolve the named change's working directory before all per-change reads.

`explain change-harness` uses `resolveHarnessConfig` for that directory, showing
stage agents, models, autonomy, review/checkpoint gates, declared steps and all
budget units. Invalid configuration fails; it must not silently become defaults.
Report unsupported terminal agents as unsupported, not executable.
`show agents` lists registry/provider and existing capability facts; it neither
launches an agent nor asserts authentication from executable detection.

Rejected: hand-maintained lists, speculative health/next-step judgements and
CLI-owned configuration merges, which diverge from core.

### Run identifiers, retained output and spending

`show run` takes the persisted core `runId`, not the status `instanceId` used
by `stop run` and `send message`. Read repository audit entries and existing
retained run logs; return ordered entries, outcome and retained output with
explicit missing/truncated-log facts. Audit summaries alone are not a full
stdout stream. If a live status refers to a runId, display both ids; do not
guess mappings for expired statuses. A known run with pruned output still
returns its audit metadata; an unknown run exits 1.

`show cost` reads `readRepositoryAuditEntries` and delegates aggregation to
`buildUsageReport`. Group by runId and associate all recorded changeDir values
that resolve to the named change in this repository. Preserve costByUnit,
tokens, measured runs and unmeasured runs; missing usage is not zero dollars.
No runs yields zero recorded spend with zero runs, not a claim of free work.
Do not restrict the report to only the current worktree or sum raw events twice.

Rejected: treating instanceId as runId, promising output audit did not retain,
estimating absent cost or converting credits to USD.

### Diff scope

`readChangeDiff` is explicitly an OpenSpec artifact diff under
`openspec/changes/<change>` against HEAD, including staged and untracked files.
`show diff` uses this existing behavior in the resolved directory, labels the
scope and returns files/truncation limits in JSON. It is not a diff of all
implementation source files. Entire-worktree or base-branch diff is a separate
capability, not silently added here.

Rejected: calling the existing reader an implementation diff, or bypassing its
path validation with ad-hoc shell interpolation.

### Messaging and one delegated task

`send message` addresses a live instanceId from existing status reads and
uses core `sendMessage` with `kind: note`, `toKind: run`, the machine key and
the existing human/agent author policy. No CLI claim may misrepresent an
agent-authored note as human approval. Report queued messageId, not delivered
or acted-on status. Reject blank text, unknown/expired targets and invalid keys.
Do not add an unsigned route or bypass core receiver verification/freshness.

`run task` resolves the task number to its zero-based line through core task
rows, then uses the existing own-worktree delegated-run wrapper around
`runDelegatedItem`. The declared delegate chooses the agent, not an override
flag. Preserve live-run/worktree/lease checks, runner sandbox, audit, permissions,
events, interruption and the evidence/tick gate. Ordinary and human-only tasks
are refused. A completed agent that left the task open or reverted exits 1.

Rejected: starting the whole chain, blindly ticking after a successful process,
choosing a different agent or reimplementing envelope verification in CLI.

### Recovery and diagnostics

`rollback change` resolves only the owning directory and uses core recovery
eligibility/restore logic, with no duplicated journal filters. Hold the existing
mutation lease for the whole write and refuse live writers, incompatible journals
and conflicting file contents. Display consequences and require an interactive
confirmation; decline/non-TTY changes no file. Do not offer force/yes bypasses
or manufacture checkpoint coverage for CLI runs that did not capture it.
Loading recovery must follow core's existing initialization and compatibility
behavior, not treat foreign journals as safe snapshots.

`explain message` reads `MESSAGES` and `isMessageCode`, including retired status,
template placeholders, why/todo and docs URL. Allocate new diagnostics from the
current register during apply; do not reserve guessed numbers in this proposal.

Rejected: direct rollbackCheckpoint calls outside core mutation protections,
unconditional `|safe`-style trust in repository content, or guessed message ids.

## Risks / Trade-offs

- Repository audit readers skip unreadable siblings today; expose the existing
  limits and describe totals as recorded, never guaranteed complete lifetime cost.
- Deleted worktree logs cannot be reconstructed; use the existing harvested
  records when present and report missing output honestly.
- Mutating commands require real security and interruption tests, not only routing.
- New shared behavior, if proven necessary, belongs in core. An architecture or
  protocol change requires a new ADR before apply proceeds with that expansion.

## Protocol and Compatibility

No core command/event, REST or message-bridge changes are proposed. Existing
server/extension adapters remain compatible; their transport contract tests
need no additions unless implementation discovers a required protocol change.
Only new CLI routes and output contracts are additive. CLI needs a minor
changeset; core also needs a minor changeset if public APIs/messages are added.

## Verification and Release

Existing tests are extended where suitable; new handler tests are limited to
new handlers. Each spec scenario must have executable coverage. Run scoped
checks first, then pinned-runtime root typecheck/lint/test. Pack the actual CLI,
install it into a temporary consumer and exercise all twelve command paths
against fixture repositories without production effects. Record gates in tasks.
Any production release observation happens in a separately tracked post-merge
rollout, never a prerequisite claimed done before this PR can merge.

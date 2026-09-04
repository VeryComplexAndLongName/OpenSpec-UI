Path this change must hold end to end: an ACP agent reports usage →
`AcpSessionDriver` keeps it → `agent-runner.ts` writes it into the
terminal `AuditEntry` → `buildUsageReport` sums it → `checkBudget` stops
the chain. Every link but the first two already exists and has been
waiting. A change that captures usage but never reaches the audit record
leaves the ceiling exactly as inert as it is now.

Nothing here may invent a number. The whole reason this is worth doing is
that a ceiling should act on what an agent actually reported.

## 1. Capture

- [x] 1.1 `packages/core/src/agents/acp-session-driver.ts`: keep the
  `usage` from `PromptResponse` — `run()` currently takes only
  `stopReason` and drops it.
- [x] 1.2 Same file: keep the `cost` from the most recent
  `"usage_update"` notification. Continue forwarding every notification
  as `agentUpdate` exactly as now; this observes the stream, it does not
  filter it.
- [x] 1.3 Same file: do **not** record `used` as tokens spent. It is
  tokens currently in context and goes *down* after a compaction —
  recording it as consumption would under-count a long run precisely
  when it compacts.
- [x] 1.4 Prefer `PromptResponse.usage` for token totals, and take cost
  from whichever source has it. The prompt response is marked `UNSTABLE`
  and `@experimental` in the SDK, which is why the stream is a fallback
  rather than an afterthought.
- [x] 1.5 `packages/core/src/agents/claude-acp.ts`: capture usage from
  `claude`'s own terminal `"result"` line too. This adapter does not
  speak ACP at all (see its header comment), so 1.1-1.4 do not reach it —
  yet it is the agent this repository actually runs, and that line
  already carries `total_cost_usd`, a snake_case `usage` object, and a
  per-model `modelUsage` split, vendor-computed. Without this, a ceiling
  set here would still count nothing.

## 2. Record

- [x] 2.1 `packages/core/src/agent-runner.ts`: the terminal `AuditEntry`
  carries the run's reported usage. This is the link that makes every
  existing consumer work; without it this change is decorative.
- [x] 2.2 A run that reported nothing records **no** `usage` field —
  never a zero. `AuditEntry.usage`'s own contract says absent means "not
  reported", and `checkBudget` fails open on absence by design.
- [x] 2.3 Getting usage out of the adapter must not widen `AgentAdapter`
  for adapters that have none. Decide where it lives — an event, a
  return value, a driver accessor — and say why in a comment.
- [x] 2.4 A non-USD `cost` is not written to `costUsd`. Carry the
  currency; do not convert at a rate this project would have to invent.
  See design.md's open question.

## 3. Say what is covered

- [x] 3.1 `LIMITS.md`: which agents report usage and which do not, so a
  ceiling's reach is legible before someone relies on it. The raw-text
  CLIs report nothing and a ceiling over them still counts nothing.
- [x] 3.2 Same: remove any wording that implies the chain-level ceiling
  works today for everything. It has never fired for anything.

## 4. Tests

- [x] 4.1 `acp-session-driver.test.ts`: a prompt response carrying
  `usage` results in that usage being available to the runner; one
  without it results in none.
- [x] 4.2 Same: a `"usage_update"` carrying a `cost` is captured, and its
  `used` is **not** recorded as tokens.
- [x] 4.3 `agent-runner.test.ts`: a run whose adapter reported usage
  writes it into the audit entry; a run that reported none writes no
  `usage` field. Assert the absence explicitly — a test that only checks
  the present case passes with the current defect intact.
- [x] 4.4 An end-to-end case: recorded usage from a run makes
  `checkBudget` stop the chain at the next stage boundary. This is the
  claim of the change; nothing else proves it.
- [x] 4.5 Every existing audit and usage-report test still passes
  unchanged. The entry shape is being populated, not altered.
- [x] 4.6 `claude-acp.test.ts`: a `"result"` line's cost, tokens and
  per-model split are reported; a result line without them reports
  nothing; and the report precedes the terminal event — after it, the
  audit entry is already written and the report would land nowhere.

## 5. Verification

- [x] 5.1 `openspec change validate --strict usage-from-acp`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces. Read the whole failing-file list, not the
  first familiar line: `git.push.test.ts` is intermittent here and has
  already hidden one real failure behind it.
- [x] 5.3 Version bump via `npx changeset` (`@openspec-ui/core` minor).
- [ ] 5.4 **Human-only**: run a stage on `copilot-cli-acp` or
  `claude-cli-acp` and confirm `.openspec-ui/audit.jsonl` gains a `usage`
  field for it. Then set a small `budget.maxCostUsd`, run again, and
  confirm the chain stops at a stage boundary naming the budget — the
  behaviour that has never once occurred in this repository.

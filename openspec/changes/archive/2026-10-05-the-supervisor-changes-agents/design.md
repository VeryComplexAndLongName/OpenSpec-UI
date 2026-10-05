## Context

See `proposal.md` and ADR 0039. What exists after `the-supervisor-advises`:

- Every failed run carries a `FailureDiagnosis` with `repeatHelps`
  (`no`, `likely`, `unknown`), on its `failed` event and audit entry.
- `supervisor.mode` is `advise` or `off`; `act` is refused today.
- `HarnessChainRunner` runs each stage in an attempt loop bounded by
  `maxStageAttempts`, and attempts a stage again only when a ceiling cut
  it. A stage's `failed` event is yielded as it arrives, and it is the
  chain's terminal event (ADR 0012): nothing may follow it.
- A stage's agent comes from `stepAgents.<stage>`.

## Goals / Non-Goals

**Goals:**

- A chain under `act` survives a failure a repeat or another agent fixes.
- The policy is the person's, written in the change's own file, and every
  move is said and recorded.

**Non-Goals:**

- Stopping a run that is still going. The supervisor acts only on a stage
  that has already ended in failure; a silent run is still only pointed
  out (ADR 0039 decision 3).
- Judging which agent is better. The order is the person's list.
- Moving a model or an effort with the agent: an entry's settings belong
  to its agent, as `mergeStepAgent` already holds for a change of agent.
- Acting outside a chain: a single run or a delegated item is not moved.

## Decisions

1. **`act` needs three things in the change's own file.**
   - `supervisor.mode: "act"` is refused in the global file, as
     `autonomyLevel: "autonomous"` is: it widens what runs unattended.
   - It is refused unless the same file sets `autonomyLevel: "autonomous"`:
     under a level that asks a person, the person is the one deciding.
   - It is refused unless the resolved `maxStageAttempts` is above 1: a
     repeat or a move is an attempt of the stage, under the one ceiling
     every reason shares (HARNESS.md, `maxStageAttempts`). A setting that
     can never act is not accepted quietly.

2. **The policy keys.**
   - `supervisor.fallback`: `{ <stage>: [agentId, ...] }` for the stages
     that run an agent. Each id must be a registered agent other than
     `vscode-chat` (a chain cannot hand a retried stage to the editor's
     chat), and appear once. Accepted in either file: a list says what may
     be used, and only `act` uses it.
   - `supervisor.allowCostIncrease`, `supervisor.allowProviderChange`:
     booleans, absent meaning false, per change only (ADR 0018: what widens
     authority is never inherited).

3. **A provider per agent, in the registry.** `AgentDescriptor.provider`:
   `anthropic` (claude), `github` (copilot), `openai` (codex), `google`
   (gemini), `deepseek`, `local` (both local LLM agents), `vscode`
   (vscode-chat). A move to another provider sends the change's files to
   another company, which is the reason it needs its own allowance.
   A move is a cost increase unless it is to a `local` agent: nothing here
   knows one service's price against another's, and the safe reading of
   "not known" is "may cost more".

4. **The decision is a pure function in `supervisor.ts`.**
   `superviseFailure({ stage, current, tried, diagnosis, supervisor })`
   returns:
   - `{ action: "repeat", agent: current }` where repeating is likely to
     help;
   - `{ action: "move", agent }` where it will not, naming the first agent
     of the stage's fallback list that has not been tried in this chain's
     stage and that the policy allows;
   - `{ action: "none", why }` otherwise, saying which rule refused each
     candidate ("claude-cli-acp is another provider, and
     allowProviderChange is false").

5. **The chain holds a stage's failure until it is decided.** `runStage`
   no longer yields a `failed` event that came from the stage's agent; it
   keeps it on the chain's state and returns `failed`. The attempt loop
   then:
   - under `act`, with an attempt left and a decision to repeat or move,
     yields a `progress` event saying what the supervisor did and why,
     records an audit `message` entry from `supervisor`, and starts the
     next attempt, whose `stageStarted` names the agent and carries the
     reason in `previousAttemptReason`;
   - otherwise yields the held `failed` event, unchanged, and the chain
     ends as before.
   So the terminal contract holds: a `failed` event is still the last
   event of the chain it ends, and only one that ends it is yielded.
   A moved stage runs its new agent with that agent's own defaults: the
   model, effort, budget and custom agent of the old entry are not carried
   over.

6. **Under `advise`, the last-run suggestion names the fallback.** Where
   the change's last run failed at a stage that cannot simply be repeated,
   and the stage has a fallback the policy allows, the suggestion says
   which agent `act` would move it to. It still changes nothing.

7. **Surfaces.**
   - The change's Harness Settings: the Supervisor choice gains Act, offered
     only where the change's own autonomy level is Autonomous, with a note
     on cost and providers; a field per stage for its fallback agents; the
     two allowances. The global view does not offer Act or the allowances.
     Choosing Act where the change would have one attempt per stage sets
     `maxStageAttempts` to 2 in the change's file and says so in the note:
     with one attempt Act could do nothing, and the configuration would be
     refused when it resolves. A change whose autonomy level is moved away
     from Autonomous while Act is chosen is told that saving will be
     refused.
   - The audit entry is a `message` from `supervisor` with
     `supervisorDecision` (`action`, `stage`, `from`, `to`, `because`), so no
     counter of runs reads it as one.
   - The chain's timeline shows the `progress` line and the next stage's
     reason, as it shows any repeated attempt.
   - `openspec-ui-cli run` prints a repeated or moved stage's reason under
     its heading.

## Risks / Trade-offs

- **A move can cost money.** It is off unless the change's file says
  `act`, and a move to a paid agent needs `allowCostIncrease` as well.
- **A move can send the change to another company.** It needs
  `allowProviderChange`.
- **A repeat of a rate-limited stage may hit the limit again.** It is one
  attempt under `maxStageAttempts`, and the second failure ends the chain
  if nothing is left.
- **Holding the failure delays it by the decision**, which is a pure
  function over what the chain already holds.

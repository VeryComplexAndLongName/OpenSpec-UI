# 0039: The Supervisor Advises, and Acts Only Where a Change Allows It

Status: Accepted

Date: 2026-10-04

## Context

The owner asked on 2026-10-04 for an "Agentic Supervisor": a role that
watches the agents of each stage of a change, notices one that has stopped
answering, recommends stopping or restarting it, chooses another agent
where one fails, and keeps all of it inside a budget. The discussion that
followed narrowed the request, and this ADR records where it ended.

Most of what such a role would watch already exists:

- **Every run says what it is doing** (ADR 0028, `agent-status.ts`): a
  heartbeat, the moment its activity last changed, the task in hand, and
  whether it is waiting on a checkpoint or a permission.
- **A stop is a request** the run answers at a sound point (ADR 0028).
- **Time, spend and context have ceilings** (`LIMITS.md`), and a stage cut
  by a ceiling may be attempted again (`maxStageAttempts`).
- **Suggestions have a shape and a place** (`hints.ts`): a subject, the
  fact behind it and the commands that act on it, shown by one component
  in both hosts and printed by `openspec-ui-cli advise`.

What nothing does is draw a conclusion from those records. ADR 0028 left
"hung" deliberately unsaid: "the report says how long, and does not say
stuck - a long turn looks the same, and the judgement is a person's". The
last weeks showed what that costs. A run waiting for a permission nobody
saw read as a hung one. A CLI blocked by security software, an agent that
was not signed in, and an agent that was not installed each failed as
`<executable> exited with code 1`, and nothing said that trying again
would fail the same way.

The discussion also rejected most of the original request:

- **Running several agents on the tasks of one change** was set aside
  until its benefit is measured. Tasks in a change usually depend on one
  another, the files every change touches (a changeset, the lock file,
  summary tables) would collide in every merge, and one local GPU shares
  its throughput between parallel requests. Changes already run side by
  side (ADR 0022, ADR 0024).
- **A model deciding what to stop or restart** was rejected. A rule can be
  tested; a model's judgement cannot, and a supervisor that can hang would
  need a supervisor.

## Decision

1. **The supervisor is rules over records that already exist, not a
   process and not a model.** Pure functions read the status records and
   the audit log and produce suggestions in the existing `Hint` shape. No
   timer, no polling of its own and no background work: they run where a
   reading is already made (the Pipeline, `advise`, a run's end). It
   costs nothing a person would notice.

2. **It has three modes, set by `supervisor.mode`.**
   - `off`: none of its suggestions are computed.
   - `advise` (the default): it suggests, and changes nothing.
   - `act`: it may also do the one thing a change permits it to do (see
     4). Accepted only in a change's own `harness.json` and only with
     `autonomyLevel: "autonomous"`, by the rule ADR 0018 set for anything
     that widens authority: per change, never inherited.

   `advise` is on by default because it writes nothing, starts nothing
   and spends nothing. Turning `act` on is warned about, because it can
   start a dearer agent.

3. **A conclusion is stated with the fact it rests on, and a stop is
   still only recommended.** A run whose heartbeat is alive and whose
   activity has not changed for longer than a threshold is pointed out as
   saying nothing new for that long, with what it last said. A run waiting
   on a person is pointed out as waiting, so it is never mistaken for a
   hung one. The supervisor never stops a run itself, in any mode: it
   names the command that asks it to stop. This amends ADR 0028's "does
   not say stuck" to "says how long, and suggests what to do", and keeps
   its rule that the judgement is a person's.

4. **A failed run is diagnosed before anything is tried again.** Where a
   run fails, its reason and the end of its output are read for a known
   cause: the agent is not installed, not signed in, blocked by security
   software, cannot reach the network, was rate-limited, or met a server
   error. The diagnosis says whether repeating can help, and what to do
   instead where it cannot. It is recorded on the failure and in the
   audit log. An unknown cause is said to be unknown, never guessed.
   In `act`, and only there, a change may name agents to fall back to
   (the second change, `the-supervisor-changes-agents`): the chain then
   moves to the next agent where the diagnosis says repeating cannot
   help, within limits on cost and provider the change states, and says
   so.

5. **Everything it says is available from a terminal and from both
   hosts.** Its suggestions ride the readiness payload as the others do
   and are rendered by the same component; `advise` prints them; a run's
   failure shows its diagnosis wherever the failure is shown.

## Alternatives Considered

- **A separate supervisor process or agent.** Rejected: it would read the
  same records the Pipeline already reads, and it would itself need
  watching.
- **A model judging progress.** Rejected for the reasons in Context.
- **Stopping a silent run automatically.** Rejected: a long turn and a
  hang look the same from outside (ADR 0028), and the ceilings that do
  stop a run (`timeout`, `maxContextShare`) are ones a person set.
- **Parallel agents within one change now.** Deferred, not rejected. The
  measurement that would justify it is how many archived changes hold two
  or more groups of tasks that touch no common file. Until it is made,
  nothing here depends on it.
- **Retrying every failure.** Rejected: `maxStageAttempts` already
  refuses to repeat a failure on its merits, and a diagnosis is what lets
  a person, or `act`, tell the failures that a repeat can fix.

## Consequences

- `Hint` gains kinds about runs, not only about changes.
- A failed event and a failed audit entry may carry a diagnosis. Both are
  optional fields: every reader written before them reads on.
- The thresholds are configuration, with defaults, and a threshold is
  checked only when a reading is made; a run is pointed out at the next
  reading after it crosses one, not at the second it does.
- The diagnosis is pattern matching over text agents print. It will miss
  causes nobody has seen yet, and each one added is added with the text
  it was seen with.

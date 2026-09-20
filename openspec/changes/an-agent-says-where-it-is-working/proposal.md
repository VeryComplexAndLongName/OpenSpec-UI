## Why

On 2026-09-20 two agents worked on this repository at once: this one and
the article campaign's. They collided, and the collision is worth stating
exactly, because the obvious diagnosis is the wrong one.

They were working on **different changes, on the rule we already had** -
one change, one branch, one pull request. That rule held, and it did not
help. A branch is a name for a line of commits; the thing two agents
share is a **working directory**, which has one checked-out branch and one
index. The second agent's files were staged in the first agent's index,
under the first agent's branch, and neither agent could see that until a
commit was about to carry the other's work.

Three separate holes, found in one morning:

1. **Nothing says where an agent works.** `ADR 0027` gives this product a
   working directory per change, and the runbook says a change is one
   branch and one pull request - but nothing says the work happens in a
   directory of its own. The rule we wrote for the runs this product
   starts was never written for the agents that write this repository.
2. **Nothing says an agent is there.** A status record is written by
   `withAgentStatus`, which wraps a **run**. Two agents editing files are
   not runs, so `.agent-status` was empty while both were working, and the
   Pipeline showed nobody.
3. **Nothing holds a resource that is not a directory.** Three of the
   other agent's browser specs failed in a parallel run and all six passed
   alone. Separate working directories would not have helped: what they
   contend for is this machine's ports and processor.

## What Changes

- **The runbook says where an agent works**: a change is worked in its own
  directory under the worktree root, named for the change, and the shared
  checkout stays on the default branch. Beside the branch rule, because
  they answer different halves of the same question.
- **An agent can say it is here without being a run.** The same signed,
  heartbeating record `.agent-status` already holds, written by a session
  rather than by a chain: who, which working directory, what it is doing.
  The Pipeline and the leases already read that directory, so both hosts
  show it with nothing new to teach them.
- **A shared resource on this machine can be claimed.** A signed record
  saying who holds `browser-suite`, since when, with a heartbeat and an
  expiry. Whoever wants it waits a bounded time, saying whom it waits for,
  and then reports rather than proceeding.

## Capabilities

### Modified Capabilities

- `execution-core`: a working agent is visible whether or not it is a run,
  and a machine's shared resource can be claimed.

### New Capabilities

(none - the records and their directory already exist)

## Impact

- `packages/core`: `agent-status.ts` and a new `resource-claim.ts`, with
  their tests.
- `packages/cli`: the command an agent runs to say it is present, and to
  claim a resource.
- `openspec/README.md`.
- A changeset for `@openspec-ui/core` and `@openspec-ui/cli`.

## Explicitly out of scope

- **Coordination between machines.** One person, one computer, decided
  with the owner on 2026-09-20. ADR 0028 already records the trigger that
  would reopen it - the channel's directory becoming reachable by somebody
  untrusted - and nothing here weakens that.
- **Agents instructing each other.** `allowAgentMessages` stays off by
  default. Coordination here is publishing facts a reader can check, not
  sending instructions: a run that takes instructions from another run has
  a second operator nobody chose.
- **Enforcing the claim.** Nothing stops an agent that ignores it, and
  nothing here tries. A claim makes a collision visible and attributable;
  the operating system owns enforcement, as ADR 0028 already says of
  ownership.
- **Preventing what happened to the pictures.** One agent reverted another
  agent's modified files in the shared tree. No protocol prevents a
  judgement like that; it is a rule, and it is written where rules live.

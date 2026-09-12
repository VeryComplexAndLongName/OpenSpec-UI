# A doctor says what would stop a run

## Why

`resolveChainStart` in `packages/core/src/chain-preflight.ts` already
resolves every precondition of a run before anything is spent — the
change exists, its configuration reads, its autonomy level starts a
chain, a confirmation can be answered, no blocker is unmet, every stage
resolves an agent this build carries. Its header says why: "an
unattended run cannot" discover a missing agent at the stage that needs
it, because the two stages already paid for were paid for nothing.

Every one of those answers is available only by naming a change and
asking to run it. A person setting this tool up for the first time, or
on a new machine, finds out what is missing by being refused — which is
precisely the shape `a-lease-says-who` rejected for the workspace lease:
"a strange way to ask a question, and one that only answers it at the
moment you are being told no."

Raised in review on 2026-09-12 as part of making the tool easier to
start using. What is missing is the same command the lease got: ask the
question directly.

## Capabilities

### New

- `openspec-ui-cli doctor`: what this machine and this workspace have,
  and what would stop a run — the runtime against the pinned engines,
  the `openspec` CLI, which agent binaries are on the PATH, whether the
  workspace's harness configuration reads, who holds the workspace, and
  whether a git identity is configured.
- `--change <id>`: the same report plus the real preflight for that
  change, so the answer is the one the run would give, not a second
  opinion.
- `--format json`, the same shape the reader returns.

### Modified

- Nothing. This reports on what exists; no setting, refusal or default
  changes.

## Out of scope

Fixing anything. The doctor installs nothing, writes nothing and
configures nothing. Where a finding has a remedy the repository already
has a command for, it names that command.

Deciding for itself which agents are installed. That is
`detectAvailableAgentsDetailed`'s question, already answered for the
REST route, the VS Code bridge and the agent picker; this report asks it
rather than probing a second way — see `design.md`.

Network checks. Whether an agent's service is reachable, whether a
token is valid, whether GitHub is up: each is a question about a remote
system at one moment, and a report that says "reachable" is stale before
it is read. The doctor reports what is configured locally.

Anything about secrets. No environment variable's value, no token, no
credential is read or printed — a finding may name a variable, never
what it contains.

# A change says where it stands

## Why

ADR 0026's amendment of 2026-09-13 sets the goal: whoever works with a
change sees, at all times and wherever the change is, as accurate a
picture of it as can be read. Today each view reads one copy of each
change.

- **The Changes views read this checkout alone.** The VS Code Changes
  tree, and the standalone Changes list, show this working directory's
  copy of each change. A change can be in any of these states while the
  view shows it untouched, and a person can start it again:
  - archived on `main`;
  - ticked further in another worktree;
  - pushed on its own branch with a merged pull request;
  - running elsewhere.

  On 2026-09-13 the owner could not tell which changes an agent or the
  Harness had already done in another branch or directory.
- **`main` is never read.** Nothing in `packages/core` reads a change from
  a branch. The survey reads other working directories' files, and git
  only to list them. No code knows how old the remote's refs are.
- **Pull requests are never read.** `gh-pr-gateway.ts` creates, waits on
  and merges a pull request, but never asks what state one is in.
- **Starting a run says nothing about any of it.** The run dialog shows
  the plan for this copy, and a change archived on `main` starts like any
  other.

ADR 0028's amendment of the same day adds a second, related gap. A
delegated item was run, the agent could not finish, and its answer went
nowhere:

- the route keeps stderr only on failure;
- the audit log records `started` and `completed`;
- the reason was found only in the CLI's own transcript.

The agent had moved its work into the background and ended its turn. A
`claude -p` session ends with its turn, so there was no later.

## Capabilities

### New

- A change's **standing**, read in core across the repository:
  - this checkout's copy;
  - every working directory's copy;
  - `main`, local and remote;
  - the change's own branch;
  - where `gh` is signed in, that branch's pull request;
  - how fresh each source is.

  It is described as one word from a closed set, with the facts and their
  sources.
- A read-only fetch on a slow interval while a view showing standings is
  open, and before a run starts. Every reading states when refs were last
  fetched, and whether the fetch or `gh` failed.
- The VS Code Changes tree and the standalone Changes list show each
  change's standing in words, with a colour that agrees.
- The run dialog, in both hosts, states the standing first. Where the
  change is archived or deleted on `main`, merged, or running elsewhere, it
  asks the person to confirm before any path can start.
- A request to an agent and its reply share an envelope: `id`, `kind`,
  `inReplyTo`, `from`, `to`, `at`, `body` and `outcome`.
  - A delegated run writes both to the audit log.
  - Its reply carries the agent's last message whether or not the item was
    closed.
  - The waiting-on inbox shows the latest reply beside its item.

### Modified

- The delegated item's prompt tells the agent to work until it has an
  answer in the turn it was given, and not to leave work running in the
  background.

## Impact

- `packages/core`:
  - `git.ts`: reading a file and a directory from a ref, fetching, listing
    refs, and when refs were last fetched;
  - `gh-pr-gateway.ts`: reading pull requests by branch;
  - new `change-standing.ts` and its browser-safe facts;
  - `security.ts`: the audit entry's message envelope;
  - `delegated-item-run.ts`: the prompt, and the request and reply;
  - `human-only-inbox.ts`: the latest reply per item.
- `packages/server`: `POST /api/change-standings`, and the reply in the
  inbox payload.
- `packages/extension`:
  - the Changes tree's descriptions and a file decoration for its colour;
  - the fetch timer;
  - the run dialog's confirmation.
- `packages/webui`: the Changes list's standing, the run dialog's
  confirmation, and the inbox's reply.

## Out of scope

- The rest of what a Pipeline card says. `a-card-says-what-its-change-is-doing`
  draws the card, and takes its state word from `describeChangeState`,
  which this change adds, so the card and the Changes views always show
  the same word (ADR 0029's amendment of 2026-09-13).
- Acting on a change elsewhere: pulling, merging, archiving, or opening
  another directory. ADR 0026 still offers nothing that acts there.
- A conversation with an agent. One request has one reply (ADR 0028).
- Reading a clone that is not a working directory of this repository.
  Such a clone shares no refs and no status directory with this one.

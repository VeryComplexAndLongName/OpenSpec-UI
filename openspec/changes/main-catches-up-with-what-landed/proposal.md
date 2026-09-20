## Why

The owner described the shape of this on 2026-09-19:

> I start a harness from this VS Code window. Maybe two. I look at branch
> main ... after the agents land their pull requests, my main shows a drift
> of one pull request ... maybe make it so that after a change finishes,
> origin/main and the local main are brought together.

That is exactly what happens here. Agents work in other working
directories, their pull requests merge, and the window the owner watches
from sits on a `main` that is behind by however many landed while they were
looking. Nothing in the product says so. The owner finds out by running
`git log`, or by not finding out: on 2026-09-19 their checkout was
seventeen commits behind and the Pipeline looked like a wall of changes
that were, in fact, already archived.

Two facts are missing, and one action:

- **How far behind this checkout is.** `origin/main` is fetched already,
  for the standings; nothing counts the distance.
- **Which of the changes in front of me are already over.** A change
  archived on `main` is known - `change-standing.ts` reads the archive on
  the default branch and says "Archived on main" - but only for this
  checkout's own changes. A card of another working directory says nothing
  about it, which is the case the owner met.
- **Catching up.** A fast-forward is one command, and the reason not to
  offer it has always been that it can eat uncommitted work. That is a
  refusal to write, not a reason to leave the person to the terminal.

## What Changes

- **A reading of the drift**: which branch this checkout is on, how far
  behind and ahead of its remote it is, and which of the changes it can
  see are archived on the default branch.
- **The Pipeline says it**, above the picture: `main is 5 commits behind
  origin/main; 2 of these changes are archived on main`, with a **Catch
  up** press.
- **Catching up is a fast-forward and nothing else.** It refuses a tree
  that is not clean, a branch that has commits the remote does not have,
  and a branch that is not the checkout's default. Each refusal says which
  it is.
- **A card of another working directory says "archived on main"** where
  the standings say so, beside the other facts it already states.

## Capabilities

### New Capabilities

- `execution-core`: the drift between a checkout and its remote, and the
  fast-forward that closes it.

### Modified Capabilities

- `shared-ui`: the Pipeline says how far behind the checkout is and offers
  to catch up.

## Impact

- `packages/core`: `git.ts` gains two calls, and a new `main-drift.ts`.
- `packages/webui/src/components/PipelineView.tsx` and `shell-ui.ts`.
- `packages/server/src/rest.ts` and `packages/extension` wire the reading
  and the action for their own host.
- A changeset for core, webui, server and the extension.

## Explicitly out of scope

- **Pulling, merging or rebasing.** A fast-forward moves a pointer and
  touches nothing else; anything that can conflict belongs in a terminal
  where the person can see what happened.
- **Catching up by itself.** Nothing moves a branch without a press. A
  checkout is somebody's workspace, and a product that updates it while
  they read is a product that loses their place.
- **Other branches.** The drift is read for the checkout's default branch
  against its remote. A feature branch's distance from its base is a
  different question, and a person working on one knows it.
- **Fetching more often.** The standings already fetch at most once per
  interval, and this reading uses what they fetched.

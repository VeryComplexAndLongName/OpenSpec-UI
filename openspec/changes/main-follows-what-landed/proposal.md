## Why

On 2026-09-21 the owner reloaded the editor, and the sweep opened an
archive pull request. Its changes stayed in Changes. Then the owner asked
where the fourth change it archived had been, since the Pipeline had shown
three.

Both answers were the same. The views read this checkout, and the owner's
`main` was three commits behind `origin/main`. The archive pass reads the
server.
- A change that landed while the checkout was behind appeared on no view
  at all once its working directory was removed:
  `the-sweep-finishes-what-it-starts` merged at 19:55, and its directory
  went minutes later.
- An archive that merged left its changes on screen until somebody
  pulled.

The catch-up that closes that gap exists (`main-catches-up-with-what-landed`),
behind a button. The owner asked for it to happen by itself. Asked in the
same exchange:
- "Archive the 4 changes that landed" named none of the four;
- the Pipeline should say which changes the server holds that this
  checkout does not.

## What Changes

- **`main` follows what landed.** After its other work, the workspace
  sweep brings the main working directory's `main` up to `origin/main` by
  fast-forward alone, through the existing `catchUpWithMain`. It does so
  only when all of these hold:
  - the checkout is the one the host has open;
  - it is the main working directory, on `main`;
  - its tree is clean and `main` has no commits of its own;
  - no run is working in it.

  Otherwise `main` is left where it is, and the sweep says how far behind
  it is and why, or nothing where the checkout is simply on another
  branch. Nothing is pushed. `branches.followMain`, on by default, turns
  it off.
- **The editor sweeps again 15 minutes after it opens an archive pull
  request.** That is about as long as the pull request's checks take, so
  the archive reaches the checkout then rather than on the half-hour
  interval.
- **The drift line names what it hides.** `readMainDrift` lists the
  changes under way on `origin/main` that this checkout does not hold, and
  `driftWords` says them: "2 changes there are not shown here: a, b".
- **An archive pull request names what it archives**: "Archive alpha",
  "Archive alpha and beta", "Archive alpha, beta and 2 more". The commit
  gets the same title.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the sweep follows `main`; the drift names what is not
  here; archive titles.
- `vscode-extension` - the second sweep after an archive pull request.

## Impact

- `packages/core/src/workspace-sweep.ts`, `harness-config.ts`
  (`branches.followMain`, `followsMain`), `harness-config-schema.ts`,
  `main-drift.ts`, `main-drift-facts.ts`, `landed-archive.ts`
  (`landedArchiveTitle`).
- `packages/extension/src/extension.ts`, and its schemas, regenerated.
- `HARNESS.md`, `README.md`.
- A changeset: core, the server and the extension.

## Explicitly out of scope

- **Moving a checkout that is not clean or that has commits of its own.**
  Only a fast-forward, only over nothing of the person's.
- **Working directories other than the main one.** Their branches are
  rebased by `branches.rebaseWhenBehind`.

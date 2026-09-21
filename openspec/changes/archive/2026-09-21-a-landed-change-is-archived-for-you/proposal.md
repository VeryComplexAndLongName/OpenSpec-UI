## Why

A change that has landed stays in `openspec/changes/` until somebody
archives it by hand, in a second pull request. On 2026-09-21 the owner
found `the-change-graph-reads-once` still in the Pipeline after it merged
in #656, and asked whether that was how it should be. The owner's rule:
done changes must be archived and merged, and shown only in the archive.

Since `a-change-lands-with-nothing-open` and
`a-change-is-archived-with-nothing-open`, "finished" is something the
default branch answers by itself. A change whose directory is there and
whose task list is closed item by item owes nothing. What is missing is
anybody acting on that answer.

## What Changes

- **ADR 0035.** A change that has landed and owes nothing is archived for
  you, by the workspace sweep that already removes finished working
  directories and rebases behind branches.
- **One pull request per pass.** Every finished change is archived on an
  `archive-landed-<date>` branch, made in a directory outside the
  workspace. The branch is pushed, a pull request is opened and asked to
  merge when its checks pass, and the directory and local branch are
  removed. While one is open, no other is made.
- **A change still being worked on is left alone.** That means one whose
  own pull request is open, or whose task list still has an open item.
- **A change that landed owing something is named, never archived.** It
  shows in the editor as a warning (once a session) and in the output, and
  in the standalone under "Done for you".
- **`archive.whenLanded`**, in `openspec/agent-harness.json` and a
  change's own `harness.json`, on by default.
- **A `Forge` interface** for what the product asks of the server that
  hosts the repository: the pull requests, a new one, and a merge once
  checks pass. It is implemented for GitHub through `gh`. GitLab and Gitea
  implement the same interface later.
- The sweep now runs whenever the workspace has a remote. Before, it did
  nothing unless a working directory or a change branch was there to act
  on.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the sweep archives what has landed.
- `vscode-extension` - what the editor says about it.

## Impact

- New `packages/core/src/landed-archive.ts`. Changed:
  `workspace-sweep.ts`, `gh-pr-gateway.ts` (`Forge`,
  `createGitHubForge`), `git.ts` (`stagePath`, `deleteBranch`), and
  `harness-config.ts` (`archive`).
- `packages/extension/src/extension.ts`.
- `docs/adr/0035-a-landed-change-is-archived-for-you.md`, `HARNESS.md`,
  `README.md`, `openspec/README.md`.
- A changeset: core and the extension change. The server's sweep endpoint
  says the new lines with no change of its own.

## Explicitly out of scope

- **GitLab and Gitea.** They implement `Forge` in their own change.
- **A setting in either UI.** `branches.rebaseWhenBehind` is hand-edited
  too.
- **The harness JSON schemas.** They know 4 of the 13 top-level keys and
  forbid the rest. That is its own defect, and it is deferred.

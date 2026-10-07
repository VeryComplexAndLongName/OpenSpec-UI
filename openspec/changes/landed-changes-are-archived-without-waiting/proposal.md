## Why

On 2026-10-07 the owner asked why changes that had landed lay unarchived,
with OpenSpec Workbench not coming for them. The extension's output and
the forge's timestamps answer it:

- **The sweep ran only once the Workbench view was opened.** The extension
  declared no activation event, so VS Code started it, and the sweep with
  it, only when its view was opened. A window on this repository stayed
  open all morning with the view closed: #831, merged at 21:09 the evening
  before, was archived at 17:15, three minutes after the view was opened
  at 17:12.
- **A change that landed while an archive was open waited half an hour.**
  #834 and #835 merged at 14:51 and 14:59 UTC while #838 was open; #838
  merged at 15:01, and their archive, #839, was opened at 15:43: the next
  pass came at the usual thirty minutes.
- **A refused push said nothing.** In between, one pass failed to push its
  archive branch and said only "nothing was archived: To
  https://github.com/...", git's first line, not its reason; it was tried
  again thirty minutes later.
- **A fetch that failed stopped the archive silently.** In DocsAI, whose
  `origin` named a host its stored credential did not cover, a pass with
  no working directory to sweep returned nothing when the fetch failed;
  one with working directories said nothing about the archive.

## What Changes

- The extension activates in any workspace that holds an OpenSpec project
  (`openspec/changes`, `openspec/config.yaml` or `openspec/project.md`),
  whether its view is open or not.
- A host sweeps again in a few minutes rather than at its half hour where
  an archive pull request is open (as before), where one has just merged,
  where the archive failed for a new reason, or where a change's own branch
  is on the server, so its merge is followed by its archive within
  minutes. One rule in core, `sweepsAgainSoon`, for both hosts.
- A failure says git's reason (`! [rejected] ... (fetch first)`,
  `error: ...`), not where it pushed to.
- A pass that could not fetch says the archive waits, and why.

## Capabilities

### Modified Capabilities

- `execution-core`: when a host sweeps again; what a failed archive and a
  failed fetch say.
- `vscode-extension`: the extension starts in an OpenSpec workspace.

## Impact

- `packages/core`: `workspace-sweep.ts` (`sweepsAgainSoon`,
  `awaitingLanding`, `archiveUnread`, the follower), `landed-archive.ts`
  (`failureReason`), `index.ts`.
- `packages/extension`: `package.json` (`activationEvents`),
  `extension.ts`.
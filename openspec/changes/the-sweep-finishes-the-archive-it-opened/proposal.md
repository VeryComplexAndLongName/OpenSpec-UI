## Why

The owner, on 2026-09-23: an archive pull request had been waiting for an
hour. It had. Pull request #729 was opened at 10:39 UTC, its checks all
passed by 10:47, and nothing ever merged it.

Two defects, one visible symptom.

**The pass stops following what it opened.** `archiveLandedChanges`
returns early where no change could be archived, so a pass over an
ordinary workspace costs no network. The loop that follows an already-open
archive pull request stands below that return. Once #729's two changes
were archived by a second pull request, nothing was left to archive, and
every later pass returned before looking at #729 again. It would have
stayed open for ever.

**Two hosts archive the same thing.** #729 and #730 were opened 43 seconds
apart, by two hosts sweeping the same workspace - the editor and a
standalone server. Each read the forge's branches before either had
pushed, so the loop that would have made the second follow the first's
pull request saw nothing to follow. Two hosts over one workspace is the
ordinary arrangement here, not an accident.

## What Changes

- A pass with nothing to archive still follows an archive pull request of
  ours. Whether one may be open is read **offline**, from the refs a
  pruning fetch left: a branch named `archive-landed-*` still on the
  server. Where none is, the forge is asked nothing, exactly as before.
- One archive pass at a time over a workspace on a machine, through the
  advisory claim this product already has for resources a machine has one
  of. A pass that cannot take the claim leaves the archive alone and says
  who is archiving. The claim expires by heartbeat, and anything that goes
  wrong reaching it leaves the pass archiving as it would without one.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - what the sweep does about an archive pull request it
  left open, and about another host archiving beside it.

## Impact

- `packages/core/src/landed-archive.ts`, `workspace-sweep.ts`, and their
  tests.
- One requirement in `openspec/specs/execution-core/spec.md`.

## Explicitly out of scope

- **Two machines.** A claim is a file beside the working directories of
  one machine. Two people sweeping one repository from two machines are
  not coordinated by this, and the requirement says so rather than
  implying otherwise.
- **Closing a pull request the product decides is redundant.** #729 was
  closed by hand. Teaching the sweep to close somebody's pull request is a
  decision of its own, and a bigger one than finishing its own work.

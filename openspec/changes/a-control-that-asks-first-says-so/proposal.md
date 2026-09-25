## Why

Reported by a user on 2026-09-24: "From a user perspective - if a menu has
three dots, you know that there will be a dialog before anything
happens..." A card's Start opens the run dialog, and reads as if it starts
at once.

The convention is every menu's: the editor's own commands and the
operating system's end in "..." where more is asked before anything is
done. This product followed it nowhere, except two command titles that
used the single ellipsis character this repository does not write.

## What Changes

- **The Pipeline's cards**: Start reads "Start..." (it opens the run
  dialog); Stop reads "Stop..." (it asks for a reason). Stop now, Continue,
  Allow, Deny, Copy and Logs act or show at once and keep their words.
- **The standalone**: "Run with Agentic Harness..." (it opens the run
  dialog).
- **The editor's command titles**, read from each handler, not guessed: the
  twenty-two that ask before acting gain "...", among them Run, Create
  Change, Add Relation, the three filters, Say Something to This Run and Join
  the Team. The two already marked with the ellipsis character get three
  full stops.
- A card's accessible names are unchanged: "Start alpha" is still "Start
  alpha".
- A test holds the list: every command that asks ends in "...", no other
  does, and no title carries the ellipsis character.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - a control that asks before it acts says so.

## Impact

- `packages/extension/package.json` (titles), with its manifest test.
- `packages/webui/src/components/PipelineView.tsx` and
  `standalone-entry.tsx`, with the card test.
- `HARNESS.md` and `docs/how-to/stop-a-run.md`, which quote two titles.
- One requirement in `openspec/specs/shared-ui/spec.md`.

## Explicitly out of scope

- **Confirmations.** A delete or an archive that asks "are you sure" has
  already been told what to do; the convention does not mark it.

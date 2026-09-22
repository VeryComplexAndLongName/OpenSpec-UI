## Why

ADR 0037 decisions 3 and 4, the second change of its series. The
product cannot say whose a change is, who is doing it now, or why it went
back a step. With the people in git (`a-team-works-through-git`), a
colleague on any machine can verify a signature. What is still missing is
somewhere to write these facts that every machine sees and nobody can
quietly rewrite.

## What Changes

- **A change's history is a directory of signed events.**
  - Each event is one file in `openspec/changes/<id>/history/`, a signed
    envelope, named by its time, its key and its kind.
  - The kinds are a closed list: `owner-set`, `implementer-set` and
    `sent-back`.
  - An event says who signed it, and whether a person or their agent
    acted.
- **Who holds a change is played forward** from its history
  (`playHistory`). The rules are of record, not policy:
  - the first Owner is set by anyone on the team;
  - after that, only the Owner hands the ownership on;
  - the Owner sets the Implementer;
  - the Implementer may hand the work back;
  - the Owner or the Implementer sends a change back.

  Everyone named has to be on the team.
- **Recording an event** (`recordHistoryEvent`):
  - it signs the event with this machine's key after checking it against
    everything already there;
  - it refuses a key that is on nobody's file, and a retired key;
  - sending back reopens the named items in `tasks.md`, each with a line
    saying when, by whom and why.

  Nothing is committed.
- **An agent is seen as an agent.** Where nobody says who acted, the
  environment decides: `OPENSPEC_UI_AGENT`, or `AI_AGENT` as Claude Code
  and others set it, or `CLAUDECODE`.
- **The merge gate checks every history.** Compared with the base, it
  refuses:
  - a history file deleted or changed. A file moved with its change into
    the archive, unchanged, is kept;
  - a new file that does not check out, is signed off the team, or breaks
    a rule.

  A file the base already has is not judged again.
- **The CLI** gets `history`, `owner`, `implementer` and `send-back`.
- The git wrapper gains `listFilesUnder`, so the gate reads the base's
  histories in one call.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - a change's history, its rules, and recording an
  event.
- `ci-cli` - the history commands, and the merge gate's check of the
  histories.

## Impact

- New `packages/core/src/change-history.ts`,
  `change-history-facts.ts` (also exported to the browser), and their
  tests.
- `people.ts` (`personOfThisMachine`) and `git.ts` (`listFilesUnder`).
- `packages/cli/src/history-command.ts` (new), `main.ts`,
  `openspec-validate.ts`, and their tests.
- `README.md`.
- A changeset: core and the CLI, minor.

## Explicitly out of scope

- **The editor and the standalone.** Setting an Owner, sending a change
  back and reading its history on a card come with the board, where a
  change's card is where a person acts on it. The CLI serves any host
  meanwhile.
- **Stages and time in stage.** A `sent-back` event already names a
  stage from the closed list, but deriving a change's stage and its time
  in each is the next change.
- **Carrying the history into the archive.** The gate already accepts a
  history moved there unchanged. Moving it is a later change of ADR 0037.

ADR 0037 decisions 3 and 4, the second change of its series, started with
the owner on 2026-09-22.

## 1. The history in the core

- [x] 1.1 `change-history-facts.ts`, a leaf the browser also has:
  - the stages and the stages a change can be sent back to;
  - the three kinds of event, parsed and checked;
  - `playHistory` with the hand-over rules;
  - the words each event is said in.
- [x] 1.2 `change-history.ts`:
  - reads a change's history against the people;
  - `recordHistoryEvent` signs and writes an event after checking it;
  - `reopenTasks` unticks reopened items with the reason under each;
  - `actorFromEnvironment` takes the agent from `OPENSPEC_UI_AGENT`,
    `AI_AGENT` or `CLAUDECODE`.
- [x] 1.3 `checkHistories`:
  - a history file on the base has to be kept, under its change or its
    archive;
  - a new file has to check out and keep the rules;
  - a file the base has is not judged again.
- [x] 1.4 `git.ts` `listFilesUnder`, and `people.ts`
  `personOfThisMachine`.

## 2. The CLI

- [x] 2.1 `history`, `owner`, `implementer` (with `--none`) and
  `send-back` (with `--stage`, `--reason`, repeatable `--reopen` and
  `--agent`), with their exit codes.
- [x] 2.2 `validate` checks the histories, against the base where one is
  given.

## 3. Documentation

- [x] 3.1 `README.md`:
  - the CLI table;
  - the merge gate's check of the histories;
  - a section on a change's history.

## 4. Checks

- [x] 4.1 Tests:
  - `change-history.test.ts`, 14: events, the rules, reopening, the
    actor, recording, and what a pull request may do to a history;
  - `history-command.test.ts`, 6;
  - a merge-gate test;
  - `listFilesUnder` against real git.
- [x] 4.2 Live, 2026-09-22, the CLI on a temporary directory with this
  machine's key:
  - before `join`, `owner` was refused with exit 1 and "join the team
    first";
  - after `join`, `owner`, `implementer` and `send-back` each wrote one
    signed file, and `send-back --reopen "1.2:..."` unticked 1.2 in
    `tasks.md` with "Reopened on 2026-09-22 by live-check: ..." under it;
  - `owner --to nobody-here` was refused with exit 1 ("who is not on the
    team");
  - `history` printed the three events.

  Each event read "live-check's agent claude-code": the CLI was run by
  Claude Code, and `AI_AGENT` said so.
- [x] 4.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 189, core 1822 and 47,
  extension 492, server 114, webui 651.
- [x] 4.4 The whole standalone browser suite: 28 of 28.
- [x] 4.5 The extension's integration suite: 19 passing.
- [x] 4.6 A changeset: core and the CLI, minor.
- [x] 4.7 `openspec validate a-change-keeps-its-history --strict`: valid.
  The merge gate locally with `--base origin/main`: ok.

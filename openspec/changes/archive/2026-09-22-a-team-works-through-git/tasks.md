Decided with the owner on 2026-09-22: team work with no server and no
database, git and the forge as the only shared truth (ADR 0037). This is
the first change of that series: the people, in git.

## 1. The decision

- [x] 1.1 ADR 0037 "A Team Works Through Git", accepted by the owner on
  2026-09-22. It is listed in the ADR index, and ADR 0028's status points
  to it.

## 2. People in the core

- [x] 2.1 `people.ts`:
  - a person's file read and checked, named after its handle;
  - one key in two files found;
  - the people's keys as a roster for `openEnvelope`, retired keys
    included;
  - the people at a ref, read through git.
- [x] 2.2 `comparePeople`: a person or a key taken out, a key replaced, or
  a retirement changed is refused; anything added is allowed.
- [x] 2.3 `joinTheTeam`:
  - writes a person's file with this machine's key, or adds the key;
  - refuses a handle that is not one, and a key that is another's;
  - commits nothing.
- [x] 2.4 A verified person carries their handle (`EnrolledPerson`,
  `openEnvelope`).

## 3. Hosts

- [x] 3.1 CLI:
  - `join --handle --name [--email]` and `people`, with their exit codes;
  - `validate` checks the people, and with `--base` compares them with
    the base.
- [x] 3.2 Editor: **OpenSpec Workbench: Join the Team**. It suggests the
  handle and the address from the git identity, and offers to open the
  file it wrote.

## 4. Documentation

- [x] 4.1 `README.md`:
  - the CLI table;
  - the merge gate's check of the people;
  - a section on `join` and `people`.

## 5. Checks

- [x] 5.1 Tests:
  - `people.test.ts`, 12: a person's file, one key in two files, the
    roster, what a pull request may do, joining, and reading from a tree
    and at a ref;
  - `team-command.test.ts`, 4;
  - three merge-gate tests in `openspec-validate.gate.test.ts`.
- [x] 5.2 Live, 2026-09-22, the CLI on a temporary directory with this
  machine's key:
  - `join` wrote the file;
  - a second `join` wrote nothing and said so;
  - `join` under another handle was refused with exit 1 ("this machine's
    key is already live-check's");
  - `people` listed the person.
- [x] 5.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 182, core 1808 and 46,
  extension 492, server 114, webui 651. The first run stopped at the test
  budget check: `people.test.ts` states its budget now, from a measurement
  (100 ms for the twelve).
- [x] 5.4 The whole standalone browser suite: 28 of 28.
- [x] 5.5 The extension's integration suite: 19 passing.
- [x] 5.6 A changeset: core, the CLI and the extension, minor.
- [x] 5.7 `openspec validate a-team-works-through-git --strict`: valid.
  The merge gate locally with `--base origin/main`: ok.

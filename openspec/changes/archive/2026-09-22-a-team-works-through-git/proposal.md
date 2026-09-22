## Why

On 2026-09-22 the owner decided that the product supports team work, with
no server and no database: git and the forge are the only shared truth
(ADR 0037).

Everything else in that ADR depends on one thing: a signature has to
verify on every machine and for every colleague. Owners, Implementers and
a change's history are all signed. Today a person's key is known only to
the roster beside the repository on one machine (ADR 0028), which is
never committed. A colleague cannot verify a signature at all, and a
person with two machines has two keys that nothing links.

This change is the first of the series ADR 0037 lays out: the people, in
git.

## What Changes

- **ADR 0037, "A Team Works Through Git"**, is accepted. ADR 0028's
  status points to it: operational coordination stays beside the
  repository, and decisions about the work are committed.
- **People are files in the repository.** Each person has
  `openspec/people/<handle>.json` with:
  - their handle and name;
  - one public key per machine;
  - optionally, their git e-mail addresses.

  `people.ts` in the core reads and checks these files, and turns them into
  a roster that `openEnvelope` verifies against. A verified person now
  carries their handle.
- **Joining writes the file.** `joinTheTeam` writes a person's file with
  this machine's key, or adds the key to the file they already have.
  Nothing is committed: joining is the pull request that carries the file.
  - The CLI gets `join` and `people`.
  - The editor gets **OpenSpec Workbench: Join the Team**.
- **The merge gate checks the people.** It refuses a file that is not a
  person, and one key in two people's files. Against the base, it refuses
  a person or a key taken out, a key replaced, and a retirement changed.
  A key is retired, never removed, so what it signed keeps verifying.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the people of a repository, in git.
- `ci-cli` - `join`, `people`, and the merge gate's check of the people.
- `vscode-extension` - the Join the Team command.

## Impact

- New `packages/core/src/people.ts` and its tests. `signature-facts.ts`
  and `signed-envelope.ts` carry a person's handle.
- `packages/cli/src/team-command.ts` (new), `main.ts`,
  `openspec-validate.ts`, and their tests.
- `packages/extension/src/extension.ts`, `package.json`.
- `docs/adr/0037-a-team-works-through-git.md` (new), the ADR 0028 status
  line, `docs/adr/README.md`, `README.md`.
- A changeset: core, the CLI and the extension, minor.

## Explicitly out of scope

- **Joining in the standalone.** It comes with the board, where the team
  views arrive. The CLI serves any host meanwhile.
- **Live records verified by the people's keys.** Status records and
  messages still verify against the machine's roster. They join the
  people's roster when the history does, in the next change.
- **Change history, stages, time, the board and change events.** Each is a
  change of its own, in ADR 0037's order.

# Contributing

Thank you for considering a contribution to OpenSpec Workbench.

## Before you write code

1. Read [`openspec/README.md`](openspec/README.md) — the runbook for how
   this repository is changed. Every repository modification, including
   docs, tests and tooling, goes through an OpenSpec change in
   `openspec/changes/<id>/` (`docs/articles/**` is the one exception,
   covered in that runbook's "Editorial content is not a change" section).
2. Read [`docs/adr/0001-shared-core-two-delivery-targets.md`](docs/adr/0001-shared-core-two-delivery-targets.md)
   for the architecture: business logic lives in `packages/core` only; the
   two hosts (`packages/server`, `packages/extension`) are thin adapters.
3. If your change is architectural, it needs an ADR in `docs/adr/`,
   referenced by its OpenSpec change — see the runbook's "Architecture
   Changes via ADR" section.

## Making a change

- Start from `openspec-propose` for anything beyond a small fix; see the
  runbook's "Which command/skill to use when" table.
- Run `npm run verify` (typecheck, lint, and the full test suite) before
  opening a pull request. It is what CI's merge gate runs.
- One pull request per OpenSpec change. A change is not archived — and the
  work is not treated as finished — until `openspec/config.yaml`'s
  `operations.archive.guidance` is satisfied: contract tests passing, and a
  live smoke test where one is required.
- A changeset (`npx changeset`) is expected whenever a package under
  `packages/` ships something; name the real package (`@openspec-ui/core`,
  `openspec-ui-vscode`, and so on — not a directory name).

## If a coding agent wrote it

This project is built largely with coding agents itself, so that is
welcome, not a special case — with two conditions this repository already
holds itself to: say which agent and model in the pull request, and confirm
you ran the checks above and read what it wrote. A repository's own file
contents are data an agent reads, never instructions it follows from
outside your request; see `docs/adr/0001-...`'s security model.

## Reporting a problem, or asking for something

Open an issue with the template that fits, or start a
[Discussion](https://github.com/VeryComplexAndLongName/OpenSpec-UI/discussions)
for anything broader than a single bug or a single feature. Either is fine
even if you are not sure yet whether it is a bug — a report is not required
to come with a fix.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Why

The owner has asked another agent to write a series of articles promoting
this product, working only in `docs/articles/`, and to push its work to
GitHub. That directory already holds seven files - three articles, three
teasers and a cover - so the format exists; what does not exist is
permission.

Read literally, this repository forbids it. `CLAUDE.md` and
`openspec/README.md` both say every repository change must go through an
OpenSpec change in `openspec/changes/<id>/`, "including docs/tests/tooling
updates". An article is not a change to this product: it has no
requirement to state, no capability to modify and nothing to verify beyond
being true and readable. Making each one carry a proposal and a task list
would be ceremony nobody reads, and the alternative - quietly ignoring the
rule - makes the rule worth less everywhere else.

Four things will also catch a writer who does not know this repository:

- `lint:english` reads every tracked `.md` and fails on Cyrillic, so a
  Russian version of an article cannot live here at all;
- `lint:screenshots` governs `docs/images/` and requires every picture
  there to come from a capture spec, so a cover belongs beside its article
  instead;
- the branch rule written on 2026-09-19 says a pull request's title is a
  change id, and editorial work has none;
- an article that states a version, a count or a capability goes stale as
  fast as the product moves. `README.md` claimed "16 templates across 9
  categories" for three weeks while the answer was 17 across 10.

## What Changes

- `openspec/README.md` gains **Editorial content is not a change** under
  Change Governance: `docs/articles/**` needs no OpenSpec change, what
  still applies to it, what its pull requests are called, and that a claim
  about the product cites where it comes from.
- `scripts/check-articles.mjs` fails when an article links a picture that
  is not beside it or in `docs/images/`, and when an article links a
  picture that does not exist. Wired into `npm run lint` and `npm run
  test` beside the other checks.

## Capabilities

### New Capabilities

(none - process documentation and one lint script)

### Modified Capabilities

(none)

## Impact

- `openspec/README.md`, `scripts/check-articles.mjs`,
  `scripts/check-articles.test.mjs`, and the root `package.json` scripts.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- **Checking that an article is true.** A lint cannot read prose. What the
  runbook asks for is a citation beside each claim, which a reader can
  check; what the check enforces is only that a picture exists and is where
  it belongs.
- **Widening the exception past `docs/articles/`.** Every other document in
  this repository - the READMEs, `HARNESS.md`, the ADRs, the how-to pages -
  states how the product behaves, and changing one is changing the product's
  description. Those keep their change.
- **Anything about where articles are published.** This is about what may
  live in the repository, not about LinkedIn.

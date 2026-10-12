# Design

## Context

`openspec/README.md`, under "Editorial content is not a change", lists what
still applies to editorial work. One bullet requires that a claim about the
product cites the file or spec it came from, and explains why: `README.md`
claimed "16 templates across 9 categories" for three weeks while the answer
was 17 across 10. The bullet was introduced by
`an-article-is-editorial-not-a-change` (2026-09-20).

## Goals

Lift the citation obligation so future articles are not required to carry a
`## Where each claim comes from` section.

## Non-Goals

Removing the section from already-published articles, and changing any other
editorial rule (English-only, pictures beside the article, no SVG, branch
rules).

## Decisions

1. Remove the single bullet, leave the editorial section otherwise intact.
   Rejected: delete the whole editorial section, which would also drop the
   OpenSpec exemption and the picture rules that `lint:articles` enforces.

## Risks / Trade-offs

- A claim in a future article can go stale without the citation that made
  it checkable. This is accepted: the owner asked for the section to go,
  and a wrong figure in an article is no worse than a wrong figure in any
  other place an article is read.
- `scripts/check-articles.mjs` never checked for the section, so nothing
  that enforces it needs to change.

# Articles — the publishing model

Everything under `docs/articles/` is editorial, not a description of how the
product behaves — the one directory in this repository exempt from the
OpenSpec change-per-edit rule (see `scripts/check-articles.mjs`'s own
comment). This file exists so that model does not have to be reconstructed
from the directory layout every time; read it once.

## The canonical article lives under `site/`

- The article itself: `docs/articles/site/<date>-<slug>.md`.
- Its images (cover, screenshots): `docs/articles/site/<slug>/`.

`docs/articles/site/` is the one subtree another repository,
`OpenSpec-UI-Homepage` (locally `c:\Prog\OpenSpec-UI-Homepage`; on GitHub,
`VeryComplexAndLongName/OpenSpec-UI-Homepage`), reads. That repository
publishes the article on `openspec-ui.dev` and mirrors it to dev.to itself —
this repository does not post to either directly.

## Every other folder is published by hand

`devto/`, `linkedin/`, `linkedin-article/`, `reddit/`, `hackernews/`,
`dailydev/`, `community/` each hold either a short teaser/summary or a
near-duplicate of the site article, adapted to that venue's conventions
(frontmatter, length, tone). A link back to the canonical article on
`openspec-ui.dev` is mandatory in every one of them — as a `canonical_url` /
"First published on ..." line (see the `devto/` files) or an equivalent for
venues without frontmatter. Nothing in this repository posts these
automatically: the owner publishes each one by hand, in whatever order and
timing that venue calls for.

`shared/` holds assets reused across articles and venues (for example
`shared/owls/`, cover art poses), each with its own README where the asset
needs explaining.

## The CI that tells the homepage

`.github/workflows/homepage-dispatch.yml` fires only on a push to `main`
that touches `docs/articles/site/**` — the path filter is the only check;
there is no "did anything meaningful change" step beyond it. On a matching
push, it sends a `repository_dispatch` (`articles-changed`) to
`OpenSpec-UI-Homepage`, which decides what to rebuild and publish; this
repository is never checked out by that workflow, and holds no credential
beyond the dispatch token. A push that only touches another venue folder
does not start this workflow at all — those venues are manual, and a
rebuild triggered by, say, a LinkedIn draft would be noise.

## What `scripts/check-articles.mjs` still enforces

Even though `docs/articles/` is exempt from the OpenSpec change rule, this
check (`npm run lint:articles` or equivalent; see the script for the exact
command) still runs over every file under it:

- every image an article links must exist in the repository;
- no image anywhere under `docs/articles/` may be an SVG — render to PNG
  and link that instead;
- an article's pictures must resolve under `docs/articles/` (beside the
  article) or `docs/images/` (from an end-to-end capture) — nowhere else.

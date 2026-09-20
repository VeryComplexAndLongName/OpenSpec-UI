## Why

The article campaign publishes to a site of its own, whose repository is
`OpenSpec-UI-Homepage`. The articles it publishes live here, under
`docs/articles/site/` - one landed on 2026-09-20 in #623, with its cover
and its recording beside it.

Nothing tells the site. Today somebody would have to notice that an
article landed and rebuild the homepage by hand, which is the kind of
step that is remembered twice and then forgotten.

The owner asked for it on 2026-09-20: when a merge to `main` touches the
articles, tell the homepage; when it does not, say nothing.

## What Changes

- A workflow, `.github/workflows/homepage-dispatch.yml`, that runs on a
  push to `main` touching `docs/articles/site/**` and sends a
  `repository_dispatch` of type `articles-changed` to
  `OpenSpec-UI-Homepage`.
- **No "did anything change" step.** GitHub's own `paths` filter is the
  check: a push that touches nothing there does not start the workflow at
  all, which is cheaper and harder to get wrong than a diff read in a
  script.
- **A missing token skips rather than fails.** `HOMEPAGE_DISPATCH_TOKEN`
  does not exist in this repository yet, and a workflow that turns `main`
  red until somebody mints a token is a workflow that gets deleted. It
  says what is missing and exits green.
- `scripts/check-publish-workflow.mjs` gains the rule it already applies
  to the Marketplace token: the dispatch token is named by the dispatch
  workflow and by nothing else.
- The runbook's editorial section says that an article under
  `docs/articles/site/` tells the homepage when it lands.

## Capabilities

### New Capabilities

(none - a workflow and a lint rule)

### Modified Capabilities

(none)

## Impact

- `.github/workflows/homepage-dispatch.yml`,
  `scripts/check-publish-workflow.mjs` and its test,
  `openspec/README.md`.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- **Creating the token.** `HOMEPAGE_DISPATCH_TOKEN` is a credential for
  another repository; it is minted and stored by the owner, with the
  narrowest scope that can dispatch, and this change never sees it.
- **Anything the homepage does with the event.** What it builds, and
  from which files, is that repository's business. This one says "the
  articles changed" and stops.
- **Dispatching for the other venues.** `linkedin/`, `devto/` and the
  rest are published by hand to places that are not a site; a rebuild
  triggered by a LinkedIn draft would be noise. The filter is
  `docs/articles/site/**` exactly, and widening it is one line if the
  homepage ever consumes more.
- **Sending the article's content.** The event carries the commit it came
  from and nothing else: the homepage has the repository and can read what
  it needs at the version it was told about.

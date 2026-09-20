Asked for by the owner on 2026-09-20: when a merge to main touches the
articles, tell the homepage repository; when it does not, say nothing.

## 1. The workflow

- [x] 1.1 `.github/workflows/homepage-dispatch.yml` runs on a push to
  `main` with `paths: ['docs/articles/site/**']`, and on nothing else.
- [x] 1.2 It sends a `repository_dispatch` of type `articles-changed` to
  `VeryComplexAndLongName/OpenSpec-UI-Homepage`, carrying the commit it
  came from.
- [x] 1.3 It asks for no permissions on this repository's own token: the
  only credential it uses is `HOMEPAGE_DISPATCH_TOKEN`.
- [x] 1.4 Where that secret is absent it says so and exits green, rather
  than turning `main` red until somebody mints a token.
- [x] 1.5 Two merges in quick succession do not queue two rebuilds:
  the workflow takes a concurrency group and lets the newer one win.

## 2. The token is named in one place

- [x] 2.1 `scripts/check-publish-workflow.mjs` fails when a workflow
  other than the dispatch one names `HOMEPAGE_DISPATCH_TOKEN`, the same
  rule it already applies to `VSCE_PAT`.
- [x] 2.2 `scripts/check-publish-workflow.test.mjs` breaks that guarantee
  once and asserts the failure by its words.

## 3. The runbook says it happens

- [x] 3.1 `openspec/README.md`'s editorial section says an article under
  `docs/articles/site/` tells the homepage when it lands, and that the
  other venues do not.

## 4. Checks

- [x] 4.1 `npm run lint` after `git add`, and `npm run test` at the root.

  Done 2026-09-20: every lint green, including the publish-workflow check
  that now guards the dispatch token, and `test:publish-workflow` 13 of
  13.
- [x] 4.2 The workflow's YAML parses.

  Checked 2026-09-20: it reads as
  `{"on":{"push":{"branches":["main"],"paths":["docs/articles/site/**"]}},"permissions":{},"jobs":["tell-the-homepage"]}`.
- [x] 4.3 No changeset: nothing under `packages/` changes.
- [ ] 4.4 **Human-only.** The token itself: minted by the owner with the
  narrowest scope that can dispatch to the homepage repository, and stored
  as `HOMEPAGE_DISPATCH_TOKEN`. Until then the workflow skips, and this
  item records that it is waiting on a person rather than on code.

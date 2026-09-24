Asked by the owner on 2026-09-24: pictures on the site are PNG, never
SVG, and the rule is written where the publishing agent works.

## 1. The rule

- [x] 1.1 `openspec/README.md`'s editorial section: no SVG under
  `docs/articles/`, render to PNG and commit only the PNG; the published
  `.jpg` covers and the tour's `.gif` and `.webm` stay.
- [x] 1.2 `scripts/check-articles.mjs` fails an `.svg` file anywhere
  under `docs/articles/`, linked or not.
- [x] 1.3 It fails a link to an SVG from an article, local or remote,
  whatever the link's query or anchor.

## 2. Checks

- [x] 2.1 Tests: an SVG known by its name, in capitals, with a query and
  an anchor, and a PNG whose name mentions svg left alone; two SVG links
  failed by their words; an unlinked `.svg` file failed by its path. 13 of
  13 pass, the repository's own articles among them.
- [x] 2.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0, test 0
  (core 1894, server 493, extension 116, webui 665).
- [x] 2.3 `openspec validate an-article-picture-is-never-svg --strict`, and
  the merge gate locally with `--base origin/main`. Validate: valid. The
  gate refused while 2.3 was open, naming it, and passed once it was
  ticked. The article check passes on main as of #758, whose diagram was
  committed as a PNG.

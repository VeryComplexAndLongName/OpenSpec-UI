Asked for by the article agent through the owner on 2026-09-20, before it
gives `docs/articles/` one subdirectory per venue.

## 1. The article check sees a venue subdirectory

- [x] 1.1 `scripts/check-articles.mjs` walks `docs/articles/` to any
  depth, reading every `.md` under it.
- [x] 1.2 An article is named by its path relative to `docs/articles/`, so
  a message says which venue's article it is, and a relative link
  resolves against that article's own directory.
- [x] 1.3 `scripts/check-articles.test.mjs` covers an article in a
  subdirectory whose cover sits beside it, one whose cover is in
  `shared/`, and one whose picture is missing - named by its path.

## 2. The picture check sees a recording

- [x] 2.1 `scripts/check-screenshots.mjs` finds `.gif` as well as `.png`
  under `docs/images/`.
- [x] 2.2 It reads a capture as producing a `.gif` it names, the same way
  it reads a `.png`.
- [x] 2.3 `scripts/check-screenshots.test.mjs` covers a recording produced
  by a capture and one produced by nobody.

## 3. The runbook says where a picture comes from

- [x] 3.1 `openspec/README.md`'s editorial section says a picture of the
  product in an article comes from a capture under `docs/images/`, never
  from a hand-taken screenshot, and says why.
- [x] 3.2 It says where a recording lives and that its recorder is its
  capture.

## 4. Checks

- [x] 4.1 `npm run lint` after `git add`, and `npm run test` at the root.

  Done 2026-09-20: every lint green, `lint:articles` and `lint:screenshots`
  among them ("43 pictures: 43 captured"). `test:articles` 10 of 10 and
  `test:screenshots` 13 of 13.
- [x] 4.2 No changeset: nothing under `packages/` changes.

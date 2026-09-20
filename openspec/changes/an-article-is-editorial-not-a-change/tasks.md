Asked for by the owner on 2026-09-20, after giving another agent a series
of articles to write in `docs/articles/`.

## 1. The runbook says editorial content is exempt

- [x] 1.1 `openspec/README.md` gains `### Editorial content is not a
  change` under **Change Governance**, saying that `docs/articles/**`
  needs no OpenSpec change and that everything else still does.
- [x] 1.2 It says what still applies: English only, with `lint:english`
  reading every tracked `.md`, so a Russian version cannot live here;
  pictures beside the article rather than in `docs/images/`, which
  `lint:screenshots` governs; and the branch rules.
- [x] 1.3 It says what an editorial pull request is called, since its title
  cannot be a change id.
- [x] 1.4 It says that a claim about the product - a version, a count, a
  capability - cites the file or spec it came from, and why: `README.md`
  carried a wrong template count for three weeks.

## 2. A check keeps the pictures honest

- [x] 2.1 `scripts/check-articles.mjs` reads every `.md` under
  `docs/articles/` and fails when a linked picture is neither beside the
  article nor under `docs/images/`, naming the article and the link.
- [x] 2.2 It fails when a linked picture does not exist, naming it.
- [x] 2.3 A repository with no `docs/articles/` passes: an empty subject is
  not a broken check.
- [x] 2.4 `scripts/check-articles.test.mjs` breaks each guarantee once and
  asserts the failure by its words.
- [x] 2.5 Wired into `npm run lint` as `lint:articles` and `npm run test`
  as `test:articles`.

## 3. Checks

- [x] 3.1 `npm run lint` after `git add`, and `npm run test` at the root.

  Done 2026-09-20: every lint green, the new `lint:articles` among them
  ("Article check passed"), and `test:articles` 8 of 8.
- [x] 3.2 No changeset: nothing under `packages/` changes.

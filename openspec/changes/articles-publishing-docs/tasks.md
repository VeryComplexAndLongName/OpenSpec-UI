## 1. Articles publishing model, written down once

- [x] 1.1 New `docs/articles/README.md`: canonical article location
  (`docs/articles/site/<date>-<slug>.md` + `docs/articles/site/<slug>/` for
  its assets), who reads it (`OpenSpec-UI-Homepage`, publishing to
  `openspec-ui.dev` and mirroring to dev.to), every other venue folder as a
  manually-published copy/teaser with a mandatory link back, the
  `homepage-dispatch.yml` trigger (push to `main` touching
  `docs/articles/site/**` only), and the existing `docs/articles/` exemption
  from the OpenSpec-change-per-edit rule plus what `scripts/check-articles.mjs`
  still checks.
- [x] 1.2 `CLAUDE.md`: add a pointer to `docs/articles/README.md`.
- [x] 1.3 `AGENTS.md`: add a pointer to the same file.

## 2. Verification

- [x] 2.1 `npm run lint:english` passes (no new non-English text).
- [x] 2.2 Every path/command referenced in the new section actually exists.
- [x] 2.3 `openspec change validate --strict articles-publishing-docs` passes.

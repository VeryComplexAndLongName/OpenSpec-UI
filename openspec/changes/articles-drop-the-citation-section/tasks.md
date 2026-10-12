# Tasks

## 1. The runbook drops the citation requirement

- [x] 1.1 In `openspec/README.md`, remove the bullet "A claim about the
  product cites where it comes from" from the editorial section, leaving the
  other bullets (English only, pictures beside the article, no SVG, branch
  rules) intact.
- [x] 1.2 Confirm no other file requires the section: search the repository
  for "claim comes from" outside `docs/articles/` and record that only the
  removed bullet matched.

## 2. Checks

- [ ] 2.1 Run `npm run lint:articles` and record "Article check passed".
- [ ] 2.2 Validate this change with
  `openspec change validate --strict articles-drop-the-citation-section`.

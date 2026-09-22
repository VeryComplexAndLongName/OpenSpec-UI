**OpenSpec change**
`openspec/changes/<id>/` this pull request implements, or `article: <slug>`
if this is editorial content under `docs/articles/` (see
`openspec/README.md`, "Editorial content is not a change").

**What changed, and why**

**Checks run**
- [ ] `npm run verify` (typecheck, lint, test) at the root, after `git add`
- [ ] The relevant browser/integration suite, if this touches
  `packages/server` or `packages/extension`
- [ ] `openspec validate <id> --strict`, if this is a tracked change
- [ ] A changeset added, if a package under `packages/` ships something

**If a coding agent wrote this**
Which agent and model, and confirmation you read and tested what it wrote.

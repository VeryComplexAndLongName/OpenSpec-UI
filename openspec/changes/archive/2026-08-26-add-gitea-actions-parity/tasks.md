## 1. Add the Gitea Actions workflows

- [x] 1.1 Add `.gitea/workflows/quality.yml`, mirroring
  `.github/workflows/quality.yml`'s `quality` and `openspec-validate`
  jobs (same steps, same pinned `NODE_VERSION`/`NPM_VERSION`), using
  `${{ github.workspace }}` instead of `$GITHUB_WORKSPACE`.
- [x] 1.2 Add `.gitea/workflows/require-changeset.yml`, adapted from the
  validated POC: gate on `packages/*/src/**` or `packages/*/package.json`
  changes lacking an accompanying `.changeset/*.md` file.

## 2. Verification

- [x] 2.1 Both workflow files are valid YAML and were exercised in
  equivalent form during the Gitea Actions POC on the user's own Gitea
  instance (confirmed: `actions/checkout@v4` runs unmodified; the
  require-changeset check fails without a changeset and passes with
  one) — no product code changed, so no `npm run typecheck`/`lint`/
  `test` impact.
- [x] 2.2 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 2.3 Run `openspec change validate --strict add-gitea-actions-parity`.

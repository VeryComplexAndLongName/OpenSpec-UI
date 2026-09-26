# Tasks

- [x] 1.1 `packages/cli/scripts/build.mjs` externalizes `yaml` in the CLI ESM build.
- [x] 1.2 `packages/cli/package.json` declares `yaml` as a runtime dependency.
- [x] 1.3 `npm run build --workspace @openspec-ui/cli` and `npm exec --workspace @openspec-ui/cli -- openspec-ui-cli --help` pass without the dynamic require error.
- [x] 1.4 `npm exec --workspace @openspec-ui/cli -- openspec-ui-cli run a-done-change-carries-on` reaches the expected archived-change refusal.
- [x] 1.5 `openspec change validate --strict fix-cli-esm-bundle-dependencies` passes.

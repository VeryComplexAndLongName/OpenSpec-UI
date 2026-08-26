# @openspec-ui/cli

## 0.1.1

### Patch Changes

- Package `@openspec-ui/cli` for npm distribution: bundle via esbuild
  (core's own source inlined, `cross-spawn`/`simple-git` kept as real
  dependencies), add a `bin` entry (`openspec-ui-cli`), and remove
  `"private": true`. The CLI's scope is unchanged — `validate` only. The
  actual `npm publish` is a separate manual step; this environment has no
  registry credentials.

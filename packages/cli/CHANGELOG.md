# @openspec-ui/cli

## 0.1.2

### Patch Changes

- Add `--help`/`-h` to `openspec-ui-cli`, printing usage (command syntax,
  options, exit codes) and exiting `0`. Usage is now also printed
  alongside argument-parsing and unknown-command errors, so a mistake
  surfaces the available options immediately instead of only an error
  message.

## 0.1.1

### Patch Changes

- Package `@openspec-ui/cli` for npm distribution: bundle via esbuild
  (core's own source inlined, `cross-spawn`/`simple-git` kept as real
  dependencies), add a `bin` entry (`openspec-ui-cli`), and remove
  `"private": true`. The CLI's scope is unchanged — `validate` only. The
  actual `npm publish` is a separate manual step; this environment has no
  registry credentials.

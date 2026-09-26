# Design

## Decisions

- Externalize `yaml` in `packages/cli/scripts/build.mjs` and declare it in
  `packages/cli/package.json`.
- Do not replace `yaml` or rewrite its runtime; that would increase the
  change surface and diverge from the dependency used by core.

## Non-Goals

- This change does not alter the CLI command or change-run protocol.
- This change does not rerun archived changes.

## Risks / Trade-offs

The published package must include `yaml` in its dependency installation. A
direct dependency declaration makes that contract explicit and is verified by
running the built binary.

## Context

Editor search exclusions and ignored generated directories make filesystem glob
scans unreliable for policy enforcement. The policy applies to committed source,
not build output or dependencies.

## Decisions

- Enumerate files with `git ls-files` so the scanner checks exactly committed content.
- Scan tracked Markdown, TypeScript, JavaScript, JSON, and YAML for Cyrillic code points.
- Ignore generated and third-party paths even if accidentally present locally.
- Allow a violation only when the same line contains `english-policy-allow`.
- Allow an existing legacy line only when its path and normalized content hash
  match the reviewed baseline. Moving or editing it makes it a new violation.
- Exempt the captured `openspec-fixtures/show.json` file because it preserves real
  CLI output and its repository prose is data, not authored documentation.
- Print file, line, and a bounded preview for every violation.
- Run the scanner from the root `lint` script before workspace ESLint.

## Trade-offs

- Cyrillic detection enforces the repository's current practical language boundary,
  not natural-language identification for every writing system.
- Intentional Cyrillic fixtures require a visible per-line marker.
- The temporary baseline is explicit debt; package-scoped changes remove entries
  as comments and fixtures are translated.

## Architecture

This enforces existing repository policy and does not change runtime architecture.
# Fix CLI ESM bundle dependencies

## Why

ADR 0009 requires the CLI package to ship a runnable bundled binary. The
current bundle inlines `yaml`, whose runtime uses a dynamic
`require("process")` that fails when the bundle runs as ESM.

## Capabilities

### New

- None.

### Modified

- The packaged CLI resolves `yaml` as an external runtime dependency.

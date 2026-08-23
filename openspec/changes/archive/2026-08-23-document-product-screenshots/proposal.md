## Why

ADR 0001 defines two independently usable delivery targets, but the repository
documentation currently describes both without showing either interface. This
makes it difficult for readers to understand the host-specific UX before
installing or running the product.

## What Changes

- Add a concise visual comparison of the standalone application and VS Code
  extension to the root README.
- Add focused standalone screenshots to the server README and native workbench
  screenshots to the extension README.
- Store the selected image assets under `docs/images/` with delivery-specific
  names and descriptive alternative text.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a documentation-only change)

## Impact

- `README.md`
- `packages/server/README.md`
- `packages/extension/README.md`
- `docs/images/`

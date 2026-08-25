## Why

The user pointed out on 2026-08-25 that `packages/extension`'s version
moved from `0.16.2` to `0.20.0` over four merged changes today (adding 7
built-in templates and 2 new categories), but that growth was reflected
only in `packages/extension/CHANGELOG.md` and archived OpenSpec changes —
neither user-facing README (the root README's Delivery Capability Matrix,
or `packages/extension/README.md`, which is the actual VS Code Marketplace
description) mentioned the template catalog's size or breadth at all.

## What Changes

- `packages/extension/README.md`: extend the existing Templates feature
  bullet with the catalog's actual current size — 16 built-in templates
  across 9 categories (`data-layer`, `framework-migration`,
  `architecture-migration`, `testing`, `ci-cd`, `auth`,
  `containerization`, `observability`, `configuration`), covering Python,
  Node.js/TypeScript, ASP.NET Core, and language-agnostic patterns.
- Root `README.md`: add a "Built-in template catalog (16 templates, 9
  categories)" row to the Delivery Capability Matrix (both delivery
  targets already had this capability; the matrix simply never listed
  it).
- Bump `packages/extension` (`0.20.0` -> `0.20.1`, patch, docs-only) with
  a matching `CHANGELOG.md` entry, per this repository's established
  precedent of bumping for Marketplace-description-only changes (see the
  `0.15.1` entry).
- No change to `openspec/specs/template-catalog/spec.md` (docs-only, no
  behavior change).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a documentation-only change)

## Impact

- `README.md`
- `packages/extension/README.md`
- `packages/extension/package.json`
- `packages/extension/CHANGELOG.md`

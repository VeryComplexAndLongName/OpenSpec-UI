## Why

Older deliveries can encounter valid journals or checkpoints written by a newer
core. Today those failures are generic, so hosts cannot distinguish an upgrade
requirement from malformed persisted data without parsing error text.

## What Changes

- Define a fail-closed journal compatibility policy in ADR 0006.
- Add typed core diagnostics for invalid JSON, invalid shape, future journal
  versions, future checkpoint versions, and workspace mismatches.
- Preserve incompatible journal bytes and path without quarantine or rewriting.
- Surface actionable diagnostics through existing standalone and extension error paths.

## Impact

- `packages/core`: structured journal load errors and compatibility tests.
- `packages/server`: ships improved recovery diagnostics from core.
- `packages/extension`: ships improved recovery diagnostics from core.
- `docs/adr`: persisted-format evolution policy.

## Architecture

This change is governed by ADR 0006.
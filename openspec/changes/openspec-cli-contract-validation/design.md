## Context

TypeScript types do not validate child-process output at runtime. OpenSpec CLI
minor releases may add fields safely, while removals or type changes must fail
at the wrapper boundary rather than leak partially valid data.

## Decisions

- Define small structural validators for list, specs, show, validate, status,
  create, and archive JSON results.
- Validators require fields consumed by current callers and allow unknown
  additional fields for forward-compatible additions.
- Current status output without `progress` is normalized from artifact
  completion so delivery adapters retain a stable core contract.
- `OpenSpecCliCompatibilityError` identifies the command, expected contract,
  and a bounded output preview.
- Invalid JSON and valid-but-incompatible JSON use the same typed error class
  with distinct diagnostic codes.
- Do not gate solely on CLI semver. Runtime output shape is the authoritative
  compatibility signal; CI's pinned CLI provides the supported baseline.

## Trade-offs

- Validators intentionally cover consumed fields rather than every CLI field.
- New caller dependencies on optional output require updating the matching validator.

## Architecture

Validation remains in `packages/core` alongside CLI execution. No delivery or
protocol ownership changes, so no ADR is required.
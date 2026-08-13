## 1. Core Contract Validation

- [x] 1.1 Add typed invalid-JSON and incompatible-shape diagnostics.
- [x] 1.2 Validate required consumed fields for each JSON wrapper.
- [x] 1.3 Allow unknown additive fields and bound diagnostic output previews.

## 2. Tests and Delivery Behavior

- [x] 2.1 Add malformed JSON and incompatible shape tests for wrapper families.
- [x] 2.2 Confirm valid fixtures with additive fields remain accepted.
- [x] 2.3 Confirm server and extension existing error paths expose compatibility guidance.

## 3. Verification

- [x] 3.1 Bump affected package versions and update release documentation.
- [x] 3.2 Run focused tests, workspace verify/build, and strict OpenSpec validation.
- [x] 3.3 Run all JSON wrappers against pinned OpenSpec CLI 1.7.0 in this repository.
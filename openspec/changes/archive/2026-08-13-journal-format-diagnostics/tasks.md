## 1. Core Diagnostics

- [x] 1.1 Add stable journal load diagnostic codes and metadata.
- [x] 1.2 Detect unsupported journal and checkpoint versions before deserialization.
- [x] 1.3 Test corruption, future versions, workspace mismatch, and byte preservation.

## 2. Delivery Behavior

- [x] 2.1 Confirm standalone recovery returns actionable core diagnostics.
- [x] 2.2 Confirm the extension recovery-disabled path displays actionable diagnostics.
- [x] 2.3 Bump affected package versions and update release documentation.

## 3. Verification

- [x] 3.1 Run focused core, server, and extension tests.
- [x] 3.2 Run workspace verify/build and strict OpenSpec validation.
- [x] 3.3 Run live future-journal diagnostics smoke through the standalone server.
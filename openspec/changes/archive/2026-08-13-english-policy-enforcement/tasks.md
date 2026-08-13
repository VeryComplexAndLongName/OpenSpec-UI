## 1. Policy Scanner

- [x] 1.1 Add a dependency-free tracked-file Cyrillic scanner with bounded diagnostics and a hashed legacy baseline.
- [x] 1.2 Add scanner tests for new violations, markers, exclusions, baseline matching, and tracked-file filtering.
- [x] 1.3 Run the scanner from the root lint/verify gate.

## 2. Repository Cleanup

- [x] 2.1 Translate ADR 0001 and package READMEs.
- [x] 2.2 Record remaining reviewed source, historical-note, and fixture debt in the hashed baseline.
- [x] 2.3 Document the package-scoped path to a zero baseline.

## 3. Verification

- [x] 3.1 Bump affected package patch versions and update release documentation.
- [x] 3.2 Run the English scanner, workspace verify/build, and strict OpenSpec validation.
- [x] 3.3 Confirm the scanner rejects an injected unmarked violation in a temporary tracked fixture.
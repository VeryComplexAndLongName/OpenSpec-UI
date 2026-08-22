## 1. Checkpoint exclusions

- [x] 1.1 Exclude sensitive environment and generated cache paths before file
  contents are read.
- [x] 1.2 Sanitize excluded paths from deserialized historical checkpoints.
- [x] 1.3 Add focused capture and migration tests.
- [x] 1.4 Honor repository Git ignore rules, including nested and negated
  patterns, while retaining a non-Git fallback.
- [x] 1.5 Add focused Git-ignore checkpoint tests.

## 2. Release and verification

- [x] 2.1 Bump affected package patch versions.
- [x] 2.2 Run focused core tests and typecheck.
- [x] 2.3 Validate this OpenSpec change strictly.
- [x] 2.4 Bump core and extension patch versions for Git-ignore support.
- [x] 2.5 Re-run repository verification and strict change validation.

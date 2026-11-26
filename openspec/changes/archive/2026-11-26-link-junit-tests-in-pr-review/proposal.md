## Why

PR Review can display JUnit evidence, but linking an exact testcase requires
hand-editing JSON. That makes similar testcase names easy to confuse and adds
work every time a reviewer fills a gap. ADR 0001 calls for shared behavior
with host-appropriate controls, so both hosts should use the same mapping rules.

## What Changes

- Choose a committed scenario and search the unique testcases in its change's
  imported JUnit report from PR Review.
- Preview the addition to `scenario-tests.json` and confirm it separately.
- Preserve report provenance and show unlinked scenarios.

## Capabilities

### New

None.

### Modified

- `pr-review`: preview and save exact JUnit associations from the review.

## Impact

Shared Core validation, standalone review actions and native VS Code review
controls. Existing mapping files and JUnit imports remain compatible.

## Changelog

Affected deliveries: VS Code extension, standalone server, and the npm CLI's
bundled Workbench.

- In PR Review, search an imported JUnit report, select a testcase for an
  OpenSpec scenario, and preview the mapping before saving it.

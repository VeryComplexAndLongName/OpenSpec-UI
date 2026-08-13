## Why

Repository policy requires English in comments, descriptions, and Markdown,
but legacy Russian text remains across architecture docs, package docs, source
comments, and tests. CI does not currently enforce the policy.

## What Changes

- Translate policy-critical architecture and package documentation to English.
- Record remaining legacy violations as exact path and line-content hashes.
- Reject new or modified unapproved text in the normal lint gate.
- Keep intentional internationalization fixtures behind explicit inline markers.
- Exempt only the captured real CLI JSON fixture whose source content is data.
- Reduce the baseline to zero through separate package-scoped cleanup changes.

## Impact

- New repository-authored text becomes English-only immediately.
- Existing source cleanup becomes measurable and can proceed without risky bulk rewrites.
- Root tooling gains a dependency-free policy check.
- Package versions receive documentation-only patch bumps where package docs change.
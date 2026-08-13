# English Policy Maintenance

Repository-authored comments, descriptions, and Markdown must be English.
`npm run lint:english` enforces this policy over files returned by
`git ls-files`.

## Legacy Baseline

`scripts/english-policy-baseline.json` records reviewed legacy lines as a
combination of repository path and normalized-content SHA-256. It is migration
debt, not a general allowlist. Moving or editing a baseline line causes the
check to fail.

Cleanup changes should be package-scoped:

1. Translate or remove legacy text without changing runtime behavior.
2. Run package tests and typecheck.
3. Regenerate the baseline with
   `node scripts/check-english.mjs --write-baseline`.
4. Review the baseline reduction and run `npm run lint:english`.

New baseline entries are not accepted. The target is an empty baseline, reached
through independently reviewable package and historical-document cleanup changes.

Intentional internationalization fixture lines may use the inline
`english-policy-allow` marker. The marker must be on the same line as the fixture.
Captured external data may be exempted only by an exact path in the scanner and
requires an OpenSpec-reviewed change.
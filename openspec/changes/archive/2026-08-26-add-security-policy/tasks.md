## 1. Enable the reporting channel

- [x] 1.1 Enable GitHub private vulnerability reporting for the
  repository via the API; confirm `enabled: true` afterward.

## 2. Document the policy

- [x] 2.1 Add `SECURITY.md`: reporting instructions (GitHub private
  advisories), what to include, supported versions, scope (local-first
  tool), and known accepted risks (referencing archived changes, not
  re-listing specific CVEs).

## 3. Verification

- [x] 3.1 Confirm the linked advisory-report URL resolves (not a 404).
- [x] 3.2 `npm run lint:english` passes.
- [x] 3.3 Run `openspec change validate --strict add-security-policy`.

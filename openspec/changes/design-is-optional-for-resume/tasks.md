Read from this repository, not reasoned about: a change with no
`design.md` reports `design -> ready`, and the chain treats that as an
unfinished proposal.

## 1. The fix

- [x] 1.1 The proposing stage counts as done when the proposal and the
  tasks are done. A missing design no longer sends a finished change back
  to `propose`.

## 2. Tests

- [x] 2.1 A change with a proposal and tasks but no design resumes at
  `apply` when tasks are unchecked, and at `verify` when they are all
  checked — not at `propose`.
- [x] 2.2 A change whose proposal is not written still starts at
  `propose`.
- [x] 2.3 A change whose tasks are not written still starts at `propose`.

## 3. Verification

- [x] 3.1 `openspec validate --strict --changes`.
- [x] 3.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-09: exit 0 — 48 cli, 799 core, 302 extension, 68 server,
  338 webui.
- [x] 3.3 Version bump via `npx changeset` for `core`.

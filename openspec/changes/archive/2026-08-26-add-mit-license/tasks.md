## 1. Add the license file

- [x] 1.1 Add `LICENSE` at the repository root with standard MIT text,
  matching `packages/extension/LICENSE`'s existing wording, holder, and
  year exactly.

## 2. Verification

- [x] 2.1 Confirm `LICENSE`'s text is byte-identical in substance to
  `packages/extension/LICENSE` (same holder, year, and MIT wording).
- [x] 2.2 `npm run typecheck` and `npm run lint` pass workspace-wide
  (confirming the new file doesn't interfere with any tooling).
- [x] 2.3 Run `openspec change validate --strict add-mit-license`.

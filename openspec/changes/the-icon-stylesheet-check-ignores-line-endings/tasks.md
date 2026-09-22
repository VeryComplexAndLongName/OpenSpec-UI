Asked by the owner on 2026-09-22: can the build-metro-icons test be turned
off on Windows.

## 1. The check

- [x] 1.1 The shipped module and the script's output are compared with
  carriage returns removed.

## 2. Checks

- [x] 2.1 Before: with the carriage returns removed, the shipped module
  equals the script's output byte for byte; raw, it does not. After:
  `build-metro-icons.test.mjs` passes on Windows, 4 of 4.
- [x] 2.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0 on Windows for the first time:
  cli 175, core 1765 and 37, extension 483, server 114, webui 651 of 651.
- [x] 2.3 `openspec validate the-icon-stylesheet-check-ignores-line-endings --strict`.

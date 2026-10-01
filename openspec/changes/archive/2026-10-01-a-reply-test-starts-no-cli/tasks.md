Found on 2026-10-01: `delegated-item-reply.test.ts` timed out in three of
five full runs and never alone.

## 1. The stand-in

- [x] 1.1 `packages/core/src/delegated-item-reply.test.ts` mocks
  `./openspec.js` with `instructionsForArtifact: async () => undefined`,
  the stand-in `delegated-item-run.test.ts` uses, and says why. Do not
  raise the file's 20 s ceiling instead.

## 2. Checks

- [x] 2.1 The file alone, `npx vitest run src/delegated-item-reply.test.ts
  --project core`: its two `runDelegatedItem` tests took 4694 ms and
  5647 ms before, and 325 ms and under the reporter's threshold after,
  3 of 3 passing.
- [x] 2.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, unpiped, exit code 0. 2026-10-01: typecheck 0, lint 0,
  test 0 (cli 192, core 1967, extension 118, server 498, webui 685).
- [x] 2.3 `openspec validate a-reply-test-starts-no-cli --strict`, and the
  merge gate locally with `--base origin/main`. Valid; the gate exit 0.

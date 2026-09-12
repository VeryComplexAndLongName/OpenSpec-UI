import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // load-variance-not-per-file-cost: `hookTimeout` is a ceiling of its
    // own, defaulting to 10000 ms, and `testTimeout` does not raise it.
    // Measured 2026-09-06 under a deliberate 8-worker CPU co-load: the
    // `afterEach`/`afterAll` hooks that remove temporary trees exceeded
    // 10000 ms in `sprint-report.test.ts` and `harness-config.test.ts`,
    // and kept doing so with the worker pool bounded — reducing
    // parallelism removed every *test* failure and no hook failure.
    // Stated once here rather than in each file: a cleanup hook asserts
    // nothing, so there is none of the reason that keeps `testTimeout`
    // tight and per-file.
    hookTimeout: 60_000,
    // src/test/** — integration Mocha tests for @vscode/test-electron
    // (see src/test/run.mjs), not vitest unit tests. dist/** — built
    // esbuild bundles (including a compiled copy of src/test/**), not
    // source files. e2e/** — Playwright, which takes the editor
    // pictures; vitest's default glob catches `*.spec.ts` and fails
    // with "did not expect test.beforeAll() to be called here", which
    // names the symptom and not the cause.
    exclude: ["**/node_modules/**", ".vscode-test/**", "src/test/**", "dist/**", "e2e/**"],
  },
});

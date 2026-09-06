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
    exclude: ["**/node_modules/**", "dist/**"],
  },
});

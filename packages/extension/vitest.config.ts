import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // src/test/** — integration Mocha tests for @vscode/test-electron
    // (see src/test/run.mjs), not vitest unit tests. dist/** — built
    // esbuild bundles (including a compiled copy of src/test/**), not
    // source files.
    exclude: ["**/node_modules/**", ".vscode-test/**", "src/test/**", "dist/**"],
  },
});

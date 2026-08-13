import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // src/test/** — интеграционные Mocha-тесты для @vscode/test-electron
    // (см. src/test/run.mjs), не юнит-тесты vitest. dist/** — собранные
    // esbuild-бандлы (в т.ч. скомпилированная копия src/test/**), не
    // исходники.
    exclude: ["**/node_modules/**", ".vscode-test/**", "src/test/**", "dist/**"],
  },
});

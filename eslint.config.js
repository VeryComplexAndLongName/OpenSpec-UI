// Shared flat ESLint configuration for all packages in the monorepo.
// Minimal setup: typescript-eslint recommended, without type-checked rules
// so we do not require a single repo-wide tsconfig.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Node-скрипты сборки/тестов (build.mjs, run.mjs и т.п.) — не браузерный
    // код, нужны Node-глобалы (console/process/__dirname).
    files: ["**/*.mjs", "**/*.cjs", "**/scripts/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);

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
    files: ["packages/core/src/web-research.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": [
        "error",
        { path: "always", types: "prefer-import", lib: "always" },
      ],
    },
  },
  {
    // Node build/test scripts (build.mjs, run.mjs, etc.) — not browser
    // code, they need Node globals (console/process/__dirname).
    files: ["**/*.mjs", "**/*.cjs", "**/scripts/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);

// Общие опции esbuild для сборки расширения: extension host (Node/CJS) +
// Webview (браузер). Переиспользуются build.mjs (реальная сборка) и
// integration-тестом, который гарантирует наличие dist/*.js перед запуском
// живого VS Code (см. src/test/).

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function extensionHostBuildOptions() {
  return {
    entryPoints: [path.resolve(here, "../src/extension.ts")],
    outfile: path.resolve(here, "../dist/extension.js"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    external: ["vscode"],
    sourcemap: true,
    logLevel: "info",
  };
}

export function webviewBuildOptions() {
  return {
    entryPoints: [path.resolve(here, "../../webui/src/extension-entry.tsx")],
    outfile: path.resolve(here, "../dist/webview.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    sourcemap: true,
    logLevel: "info",
  };
}

/** Интеграционный test suite (tasks.md 4.1/4.2) — два отдельных выходных
 * файла (index.js + extension.test.js), не единый бандл: `index.ts`'s
 * `run()` находит тестовые файлы через `glob("**\/*.test.js")` рядом с
 * собой — паттерн из документации `@vscode/test-electron`. */
export function testSuiteBuildOptions() {
  return {
    entryPoints: [
      path.resolve(here, "../src/test/suite/index.ts"),
      path.resolve(here, "../src/test/suite/extension.test.ts"),
    ],
    outdir: path.resolve(here, "../dist/test-suite"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    external: ["vscode", "mocha", "glob"],
    sourcemap: true,
    logLevel: "info",
  };
}

/** 2.3: опциональный локальный сервер встраивает тот же standalone-шелл, что
 * и `standalone-app` (см. design.md "Decisions") — расширение носит свою
 * собственную копию этого бандла в `dist/standalone/`, а не читает
 * `packages/server`'s `dist/`/`public/` напрямую (те не пакуются в .vsix). */
export function standaloneAssetsBuildOptions() {
  return {
    entryPoints: [path.resolve(here, "../../webui/src/standalone-entry.tsx")],
    outfile: path.resolve(here, "../dist/standalone/app.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    sourcemap: true,
    logLevel: "info",
  };
}

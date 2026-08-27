// Shared esbuild options for building the extension: extension host
// (Node/CJS) + Webview (browser). Reused by build.mjs (the real build) and
// by the integration test, which ensures dist/*.js exists before launching
// a live VS Code instance (see src/test/).

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// pdfkit's package.json "exports" resolves a static `import` to its ESM
// build (js/pdfkit.node.mjs), which uses real `import.meta.url` syntax
// esbuild cannot preserve when bundling to a single CJS file -- it
// substitutes an empty object, and pdfkit's top-level `new URL(...)`
// then throws ("Invalid URL"), crashing extension activation entirely
// (core's `@openspec-ui/core` barrel re-exports the sprint-report PDF
// renderer for every consumer, extension included). Aliasing to the
// package's own CommonJS build sidesteps this: that file reads
// `__filename` instead, which esbuild *can* shim correctly for a
// node/cjs bundle, and it's a genuine bundle-time alias (not a runtime
// `require`), so the code still ends up inlined -- required, since
// `npm run package` builds the .vsix with `--no-dependencies` (no
// node_modules shipped; the extension itself has no direct dependency
// on pdfkit either, only a transitive one via `@openspec-ui/core`).
// `require.resolve` (via this file's own `createRequire`) follows the
// package's `require` export condition directly to js/pdfkit.js.
const pdfkitCjsEntry = require.resolve("pdfkit");

export function extensionHostBuildOptions() {
  return {
    entryPoints: [path.resolve(here, "../src/extension.ts")],
    outfile: path.resolve(here, "../dist/extension.js"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    external: ["vscode"],
    alias: { pdfkit: pdfkitCjsEntry },
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

export function timelineWebviewBuildOptions() {
  return {
    entryPoints: [path.resolve(here, "../../webui/src/timeline-entry.tsx")],
    outfile: path.resolve(here, "../dist/timeline.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    sourcemap: true,
    logLevel: "info",
  };
}

/** Integration test suite (tasks.md 4.1/4.2) — two separate output files
 * (index.js + extension.test.js), not a single bundle: `index.ts`'s
 * `run()` finds test files via `glob("**\/*.test.js")` next to itself —
 * the pattern from `@vscode/test-electron`'s documentation. */
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

/** 2.3: the optional local server embeds the same standalone shell as
 * `standalone-app` (see design.md "Decisions") — the extension carries its
 * own copy of this bundle in `dist/standalone/`, rather than reading
 * `packages/server`'s `dist/`/`public/` directly (those are not packaged
 * into the .vsix). */
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

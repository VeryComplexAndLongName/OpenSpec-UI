// Shared esbuild options for building the extension: extension host
// (Node/CJS) + Webview (browser). Reused by build.mjs (the real build) and
// by the integration test, which ensures dist/*.js exists before launching
// a live VS Code instance (see src/test/).

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

/** The harness settings panels: one for the global file, one per change.
 * See a-change-is-configured-from-the-change. */
export function harnessSettingsWebviewBuildOptions() {
  return {
    entryPoints: [path.resolve(here, "../../webui/src/harness-settings-entry.tsx")],
    outfile: path.resolve(here, "../dist/harness-settings.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    sourcemap: true,
    logLevel: "info",
  };
}

/** The Pipeline panel — the-pipeline-opens-in-vs-code. A bundle of its own
 * rather than `webview.js`, which carries the AI panel and its context
 * message shape. */
export function pipelineWebviewBuildOptions() {
  return {
    entryPoints: [path.resolve(here, "../../webui/src/pipeline-entry.tsx")],
    outfile: path.resolve(here, "../dist/pipeline.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    sourcemap: true,
    logLevel: "info",
  };
}

/** Integration test suite (tasks.md 4.1/4.2) — one output file per test
 * suite entry point (index.js + one per *.test.ts), not a single bundle:
 * `index.ts`'s `run()` finds test files via `glob("**\/*.test.js")` next
 * to itself — the pattern from `@vscode/test-electron`'s documentation.
 * A new `*.test.ts` file under `src/test/suite/` must be added here too
 * — esbuild does not glob its own entry points. */
export function testSuiteBuildOptions() {
  return {
    entryPoints: [
      path.resolve(here, "../src/test/suite/index.ts"),
      path.resolve(here, "../src/test/suite/extension.test.ts"),
      path.resolve(here, "../src/test/suite/chat-dispatch.test.ts"),
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

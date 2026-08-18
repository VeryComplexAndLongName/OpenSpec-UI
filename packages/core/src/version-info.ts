import { createRequire } from "node:module";

let cachedVersion: string | undefined;

/** `packages/core`'s own released version, read from its own `package.json`
 * rather than hardcoded — stays correct without a second edit whenever the
 * package version is bumped. See README.md, "Versioning": `core` is the
 * source of truth and should be shown separately when the UI displays
 * build information.
 *
 * Deliberately lazy, not a top-level constant: `createRequire(import.meta
 * .url)` breaks when this module is bundled into a different format by a
 * downstream consumer (confirmed live — the VS Code extension bundles
 * `@openspec-ui/core` into a single CJS `dist/extension.js` via esbuild,
 * where `import.meta.url` resolves to `undefined`, throwing at extension
 * activation even though the extension never calls this function). A
 * top-level `const` would evaluate that call eagerly for every consumer
 * of core's index — including ones that never need the version string. A
 * lazy function only pays that cost for callers that actually invoke it
 * (today, only `packages/server`). */
export function getCoreVersion(): string {
  if (cachedVersion === undefined) {
    cachedVersion = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
  }
  return cachedVersion;
}

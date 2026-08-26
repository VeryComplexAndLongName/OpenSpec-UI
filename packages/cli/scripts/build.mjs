// Bundles the CLI into a single self-contained ESM file for npm
// distribution (docs/adr/0009-publish-cli-to-npm.md). @openspec-ui/core's
// own source is inlined, since core is "private": true and not itself
// published — but core's real, published npm dependencies stay external
// (declared as this package's own "dependencies" instead): bundling
// cross-spawn specifically breaks at runtime ("Dynamic require of
// 'child_process' is not supported") because esbuild's ESM output can't
// safely rewrite cross-spawn's internal dynamic `require()` calls.
// Leaving genuinely published packages external avoids that entirely and
// keeps the bundle to only the code that has nowhere else to come from.

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.resolve(here, "../src/cli.ts")],
  outfile: path.resolve(here, "../dist/cli.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["cross-spawn", "simple-git"],
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: true,
  logLevel: "info",
});

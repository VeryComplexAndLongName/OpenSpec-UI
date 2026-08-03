// Общие опции esbuild для клиентского бандла — переиспользуются
// build-client.mjs (реальная сборка) и static.test.ts (гарантирует наличие
// dist/app.js перед тестом статической отдачи, не полагаясь на то, что
// `npm run build` уже был вызван вручную).

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function clientBuildOptions() {
  return {
    entryPoints: [path.resolve(here, "../../webui/src/standalone-entry.tsx")],
    outfile: path.resolve(here, "../dist/app.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    sourcemap: true,
    logLevel: "info",
  };
}

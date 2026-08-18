// Общие опции esbuild для клиентского бандла — переиспользуются
// build-client.mjs (реальная сборка) и static.test.ts (гарантирует наличие
// dist/app.js перед тестом статической отдачи, не полагаясь на то, что
// `npm run build` уже был вызван вручную).

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export function clientBuildOptions() {
  const webuiVersion = require("../../webui/package.json").version;
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
    define: {
      __OPENSPEC_UI_WEBUI_VERSION__: JSON.stringify(webuiVersion),
    },
  };
}

// Builds the browser bundle for the standalone shell
// (packages/webui/src/standalone-entry.tsx) into packages/server/dist/app.js —
// the only build step that server is responsible for (see
// openspec/changes/standalone-app/tasks.md 2.1). The output is
// git-ignored (see .gitignore, the `dist/` pattern).

import { build } from "esbuild";
import { clientBuildOptions } from "./client-build-options.mjs";

await build(clientBuildOptions());

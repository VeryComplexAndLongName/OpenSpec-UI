// Real entry point — not part of the public API, run via `npm run start
// --workspace @openspec-ui/cli -- <args>` (matches how `packages/server`'s
// dev entry point is already consumed, see design.md).

import { runMain } from "./main.js";

process.exitCode = await runMain(process.argv.slice(2));

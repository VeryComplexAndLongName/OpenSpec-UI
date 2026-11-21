// Entry point for actually running the server (dev/smoke test) — not part
// of the package's public API. `npm run start -- <workspaceRoot> <port>`.

import { DEFAULT_HOST, DEFAULT_PORT } from "./server.js";
import { createWorkbenchServer } from "./create-workbench-server.js";

const workspaceRoot = process.argv[2] ?? process.cwd();
const port = process.argv[3] ? Number(process.argv[3]) : DEFAULT_PORT;
const allowExternalCwd = process.argv.includes("--allow-external-cwd");

const server = createWorkbenchServer({ workspaceRoot, port, allowExternalCwd });
const address = await server.listen();
console.log(
  `OpenSpec Workbench server listening on http://${DEFAULT_HOST}:${address.port}/#token=${encodeURIComponent(server.accessToken)} (workspaceRoot: ${workspaceRoot}, allowExternalCwd: ${allowExternalCwd})`,
);

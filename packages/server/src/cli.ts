// Точка входа для реального запуска (dev/smoke-тест) — не часть публичного
// API пакета. `npm run start -- <workspaceRoot> <port>`.

import { buildDefaultAgentRunners } from "@openspec-ui/core";
import { DEFAULT_HOST, DEFAULT_PORT, createServer } from "./server.js";

const workspaceRoot = process.argv[2] ?? process.cwd();
const port = process.argv[3] ? Number(process.argv[3]) : DEFAULT_PORT;
const allowExternalCwd = process.argv.includes("--allow-external-cwd");

const server = createServer({
  workspaceRoot,
  host: DEFAULT_HOST,
  port,
  allowExternalCwd,
  runners: buildDefaultAgentRunners({ workspaceRoot, allowExternalCwd }),
});
const address = await server.listen();
console.log(
  `OpenSpec UI server listening on http://${DEFAULT_HOST}:${address.port}/#token=${encodeURIComponent(server.accessToken)} (workspaceRoot: ${workspaceRoot}, allowExternalCwd: ${allowExternalCwd})`,
);

// Entry point for actually running the server (dev/smoke test) — not part
// of the package's public API. `npm run start -- <workspaceRoot> <port>`.

import { FileAuditLog, auditLogPath, buildDefaultAgentRunners } from "@openspec-ui/core";
import { DEFAULT_HOST, DEFAULT_PORT, createServer } from "./server.js";

const workspaceRoot = process.argv[2] ?? process.cwd();
const port = process.argv[3] ? Number(process.argv[3]) : DEFAULT_PORT;
const allowExternalCwd = process.argv.includes("--allow-external-cwd");

// One `FileAuditLog` instance shared between the runners it audits and the
// server's own budget reader below, so persisted entries and the reader
// that sums them agree on the same file (see
// openspec/changes/audit-log-persistence/design.md).
const auditLog = new FileAuditLog(auditLogPath(workspaceRoot));

const server = createServer({
  workspaceRoot,
  host: DEFAULT_HOST,
  port,
  allowExternalCwd,
  auditLog,
  runners: buildDefaultAgentRunners({ workspaceRoot, allowExternalCwd, auditLog }),
});
const address = await server.listen();
console.log(
  `OpenSpec UI server listening on http://${DEFAULT_HOST}:${address.port}/#token=${encodeURIComponent(server.accessToken)} (workspaceRoot: ${workspaceRoot}, allowExternalCwd: ${allowExternalCwd})`,
);

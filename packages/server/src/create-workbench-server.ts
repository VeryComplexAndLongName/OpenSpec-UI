import os from "node:os";
import path from "node:path";
import { FileAuditLog, auditLogPath, buildDefaultAgentRunners, createFileRunLogs, setProcessLedgerStateRoot } from "@openspec-ui/core";
import { createServer, DEFAULT_HOST, type ServerOptions } from "./server.js";

/** Startup composition shared by the source entry and the npm launcher. */
export function createWorkbenchServer(options: Pick<ServerOptions, "workspaceRoot" | "port" | "allowExternalCwd" | "staticAssets" | "versions">) {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  setProcessLedgerStateRoot(path.join(os.homedir(), ".openspec-ui"));
  const auditLog = new FileAuditLog(auditLogPath(workspaceRoot));
  return createServer({ ...options, workspaceRoot, host: DEFAULT_HOST, auditLog,
    runners: buildDefaultAgentRunners({ workspaceRoot, allowExternalCwd: options.allowExternalCwd, auditLog, runLogs: createFileRunLogs(workspaceRoot) }),
    runnersFor: (root) => buildDefaultAgentRunners({ workspaceRoot: root,
      auditLog: new FileAuditLog(auditLogPath(root)), runLogs: createFileRunLogs(root) }),
  });
}

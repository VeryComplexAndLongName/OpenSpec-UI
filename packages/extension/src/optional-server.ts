import path from "node:path";
import type { AddressInfo } from "node:net";
import type { OpenSpecUiServer } from "@openspec-ui/server";

export class OptionalServerManager {
  private server: OpenSpecUiServer | undefined;
  private address: AddressInfo | undefined;

  constructor(
    private readonly workspaceRoot: string,
    private readonly distDir = path.resolve("dist"),
    /** The agent switches the editor's settings say (ADR 0038): passed on,
     * so the runners of this server agree with the window's own. */
    private readonly agentSwitches: { ignoreSystemProxy?: boolean; askBeforeCommands?: boolean } = {},
  ) { }

  get isRunning(): boolean {
    return this.server !== undefined;
  }

  get baseUrl(): string | undefined {
    return this.address ? `http://127.0.0.1:${this.address.port}` : undefined;
  }

  get launchUrl(): string | undefined {
    const baseUrl = this.baseUrl;
    return baseUrl && this.server
      ? `${baseUrl}/#token=${encodeURIComponent(this.server.accessToken)}`
      : undefined;
  }

  async start(): Promise<string> {
    if (this.server && this.address) return this.launchUrl as string;
    const [{ createServer }, { FileAuditLog, auditLogPath, buildDefaultAgentRunners, createFileRunLogs }] = await Promise.all([
      import("@openspec-ui/server"),
      import("@openspec-ui/core"),
    ]);
    // Shared between the runners this local server audits and its own
    // budget reader below — see cli.ts's identical pairing and
    // openspec/changes/audit-log-persistence/design.md.
    const auditLog = new FileAuditLog(auditLogPath(this.workspaceRoot));
    this.server = createServer({
      workspaceRoot: this.workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      auditLog,
      runners: buildDefaultAgentRunners({ workspaceRoot: this.workspaceRoot, auditLog, runLogs: createFileRunLogs(this.workspaceRoot), ...this.agentSwitches }),
      // A change's own worktree, where a card runs a delegated task, records
      // in its own log (a-card-works-its-own-tasks).
      runnersFor: (root: string) => buildDefaultAgentRunners({
        workspaceRoot: root,
        auditLog: new FileAuditLog(auditLogPath(root)),
        runLogs: createFileRunLogs(root),
        ...this.agentSwitches,
      }),
      staticAssets: {
        indexHtmlPath: path.join(this.distDir, "standalone", "index.html"),
        appJsPath: path.join(this.distDir, "standalone", "app.js"),
        appJsMapPath: path.join(this.distDir, "standalone", "app.js.map"),
      },
    });
    this.address = await this.server.listen();
    return this.launchUrl as string;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await this.server.close();
    this.server = undefined;
    this.address = undefined;
  }
}

import path from "node:path";
import type { AddressInfo } from "node:net";
import type { OpenSpecUiServer } from "@openspec-ui/server";

export class OptionalServerManager {
  private server: OpenSpecUiServer | undefined;
  private address: AddressInfo | undefined;

  constructor(
    private readonly workspaceRoot: string,
    private readonly distDir = path.resolve("dist"),
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
    const [{ createServer }, { buildDefaultAgentRunners }] = await Promise.all([
      import("@openspec-ui/server"),
      import("@openspec-ui/core"),
    ]);
    this.server = createServer({
      workspaceRoot: this.workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      runners: buildDefaultAgentRunners({ workspaceRoot: this.workspaceRoot }),
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

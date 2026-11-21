import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkbenchServer, DEFAULT_HOST, DEFAULT_PORT } from "@openspec-ui/server";
import { formatMessage, say } from "@openspec-ui/core";
import { untilInterrupted } from "./coordination-commands.js";
import { reportFailure, type ReportIo } from "./report-command.js";

interface WorkbenchOptions { workspaceRoot: string; port?: string; format: "text" | "json" }
interface WorkbenchDeps { assetRoot?: string; createServer?: typeof createWorkbenchServer; untilStopped?: () => Promise<void> }

/** Starts the existing interactive host; it grants no extra execution policy. */
export async function openWorkbenchCommand(options: WorkbenchOptions, io: ReportIo, deps: WorkbenchDeps = {}): Promise<number> {
  let server: ReturnType<typeof createWorkbenchServer> | undefined;
  try {
    const port = options.port === undefined ? DEFAULT_PORT : Number(options.port);
    if ((options.port !== undefined && !/^\d+$/u.test(options.port)) || !Number.isSafeInteger(port) || port < 0 || port > 65535) throw Error("--port must be an integer from 0 to 65535.");
    const workspaceRoot = await realpath(path.resolve(options.workspaceRoot));
    if (!(await stat(workspaceRoot)).isDirectory()) throw Error("--cwd must identify an existing directory.");
    const assets = deps.assetRoot ?? fileURLToPath(new URL("../dist/workbench/", import.meta.url));
    const indexHtmlPath = path.join(assets, "index.html"), appJsPath = path.join(assets, "app.js");
    for (const file of [indexHtmlPath, appJsPath]) if (!(await stat(file)).isFile()) throw Error("Packaged Workbench assets are missing; reinstall this CLI version.");
    const versions: unknown = JSON.parse(await readFile(path.join(assets, "versions.json"), "utf8"));
    if (typeof versions !== "object" || versions === null || !("core" in versions) || !("server" in versions)
      || typeof versions.core !== "string" || typeof versions.server !== "string" || !versions.core || !versions.server) throw Error("Packaged Workbench version metadata is invalid; reinstall this CLI version.");
    const buildVersions = { core: versions.core, server: versions.server };
    server = (deps.createServer ?? createWorkbenchServer)({ workspaceRoot, port, allowExternalCwd: false,
      staticAssets: { indexHtmlPath, appJsPath, appJsMapPath: appJsPath + ".map" }, versions: buildVersions });
    const address = await server.listen();
    const url = `http://${DEFAULT_HOST}:${address.port}/#token=${encodeURIComponent(server.accessToken)}`;
    io.stdout(options.format === "json" ? JSON.stringify({ url, workspaceRoot, versions: buildVersions }) : formatMessage(say("OSW-CLI-022", { url })));
    await (deps.untilStopped ?? untilInterrupted())();
    await server.close();
    server = undefined;
    return 0;
  } catch (error) {
    await server?.close().catch(() => undefined);
    return reportFailure("open workbench", error, io);
  }
}

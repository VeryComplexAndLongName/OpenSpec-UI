import { build } from "esbuild";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";
import { complianceWebviewBuildOptions, extensionHostBuildOptions } from "../../scripts/build-options.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const executable = process.argv[2];
if (!executable) throw new Error("Pass an existing VS Code executable; no editor is downloaded");
await build(extensionHostBuildOptions());
await build(complianceWebviewBuildOptions());
await build({ entryPoints: [path.join(here, "compliance-smoke.ts")], outfile: path.join(root, "dist/compliance-smoke.js"),
  bundle: true, platform: "node", format: "cjs", external: ["vscode"] });
const fixture = await mkdtemp(path.join(os.tmpdir(), "compliance-vscode-smoke-"));
const workspace = path.join(fixture, "workspace");
await mkdir(path.join(workspace, "openspec", "changes", "demo"), { recursive: true });
await writeFile(path.join(workspace, "openspec", "changes", "demo", "tasks.md"), "- [ ] 1.1 Smoke fixture\n");
try {
  await runTests({ vscodeExecutablePath: executable, extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "dist/compliance-smoke.js"),
    launchArgs: [workspace, "--disable-extensions", "--skip-welcome", "--skip-release-notes", "--disable-workspace-trust",
      "--user-data-dir", path.join(fixture, "profile"), "--extensions-dir", path.join(fixture, "extensions")] });
} finally {
  await rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
// Orchestrator for the live run (tasks.md 4.1/4.2): builds the extension +
// webview + standalone assets + test suite, spins up a disposable
// temp workspace (outside the repository — the same safety considerations
// as standalone-app's smoke-test-notes.md), and launches a real VS Code
// Extension Development Host via `@vscode/test-electron`.

import { build } from "esbuild";
import { copyFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";
import {
  extensionHostBuildOptions,
  standaloneAssetsBuildOptions,
  testSuiteBuildOptions,
  timelineWebviewBuildOptions,
  webviewBuildOptions,
} from "../../scripts/build-options.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, "../..");

async function buildAll() {
  await build(extensionHostBuildOptions());
  await build(webviewBuildOptions());
  await build(timelineWebviewBuildOptions());
  await build(standaloneAssetsBuildOptions());
  await build(testSuiteBuildOptions());
  const standaloneDir = path.resolve(extensionRoot, "dist/standalone");
  await mkdir(standaloneDir, { recursive: true });
  await copyFile(
    path.resolve(extensionRoot, "../server/public/index.html"),
    path.join(standaloneDir, "index.html"),
  );
}

async function createFixtureWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "openspec-ui-integration-"));
  const changeDir = path.join(root, "openspec", "changes", "demo");
  await mkdir(changeDir, { recursive: true });
  await writeFile(
    path.join(changeDir, "proposal.md"),
    "## Why\n\nFixture change for the vscode-extension integration test suite.\n",
    "utf8",
  );
  await writeFile(changeDir + "/tasks.md", "## 1. Fixture\n\n- [ ] 1.1 Placeholder task.\n", "utf8");
  return root;
}

async function main() {
  await buildAll();
  const workspaceDir = await createFixtureWorkspace();

  try {
    await runTests({
      extensionDevelopmentPath: extensionRoot,
      extensionTestsPath: path.resolve(extensionRoot, "dist/test-suite/index.js"),
      launchArgs: [workspaceDir, "--disable-extensions"],
    });
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Integration tests failed:", err);
  process.exitCode = 1;
});

import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extensionHostBuildOptions,
  standaloneAssetsBuildOptions,
  timelineWebviewBuildOptions,
  webviewBuildOptions,
} from "./build-options.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

await build(extensionHostBuildOptions());
await build(webviewBuildOptions());
await build(timelineWebviewBuildOptions());
await build(standaloneAssetsBuildOptions());

const standaloneDir = path.resolve(here, "../dist/standalone");
await mkdir(standaloneDir, { recursive: true });
await copyFile(
  path.resolve(here, "../../server/public/index.html"),
  path.join(standaloneDir, "index.html"),
);

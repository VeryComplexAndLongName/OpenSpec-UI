// 2.1 Serving the browser shell (packages/webui's standalone-entry.tsx,
// built by scripts/build-client.mjs). Only 2 fixed paths — not a
// full-blown static file server (not needed for this purpose; extra
// surface like directory-traversal protection is pointless for two known
// files).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";

/** Explicit paths to static files — needed when `server` is embedded
 * (bundled) into another host (e.g. `extension`'s CJS bundle for the
 * optional local server, see optional-server.ts), where `import.meta.url`
 * inside CJS output is `undefined` (esbuild strips out `import.meta` for
 * `format: "cjs"`), so a "next to this module" path cannot be computed.
 * Without an explicit override, the default paths are used (for
 * standalone/tests). */
export interface StaticAssetPaths {
  indexHtmlPath?: string;
  appJsPath?: string;
  appJsMapPath?: string;
}

/** Lazy, guarded computation of the default paths: in a bundled CJS build
 * `import.meta.url` is `undefined`, and `fileURLToPath(undefined)` throws.
 * If this were computed at the module's top level (as it used to be), the
 * `import` of this file itself would fail before the calling code even
 * got a chance to pass an explicit override (see tasks.md 4.2, a live
 * vscode-extension run where exactly this happened). */
function computeDefaultPaths(): { indexHtmlPath?: string; appJsPath?: string; appJsMapPath?: string } {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return {
      indexHtmlPath: path.resolve(here, "../public/index.html"),
      appJsPath: path.resolve(here, "../dist/app.js"),
      appJsMapPath: path.resolve(here, "../dist/app.js.map"),
    };
  } catch {
    return {};
  }
}

async function serveFile(res: ServerResponse, filePath: string | undefined, contentType: string): Promise<void> {
  if (!filePath) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "no static asset path configured for this host" }));
    return;
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "content-type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: `${path.basename(filePath)} not found — run "npm run build" in packages/server first`,
      }),
    );
  }
}

/** Returns true if the request was handled (a static path was recognized).
 * Matches on `pathname` only, ignoring any query string — the VS Code
 * extension embeds the standalone shell as `/?embed=vscode-local-server`
 * (see openspec/changes/standalone-shell-host-aware-tabs/design.md,
 * "Signal mechanism"), and that query parameter must not break serving
 * index.html. */
export async function tryServeStatic(
  url: string,
  res: ServerResponse,
  assetPaths: StaticAssetPaths = {},
): Promise<boolean> {
  const defaults = computeDefaultPaths();
  const indexHtmlPath = assetPaths.indexHtmlPath ?? defaults.indexHtmlPath;
  const appJsPath = assetPaths.appJsPath ?? defaults.appJsPath;
  const appJsMapPath = assetPaths.appJsMapPath ?? defaults.appJsMapPath;
  const pathname = url.split("?")[0];

  if (pathname === "/" || pathname === "/index.html") {
    await serveFile(res, indexHtmlPath, "text/html; charset=utf-8");
    return true;
  }
  if (pathname === "/app.js") {
    await serveFile(res, appJsPath, "application/javascript; charset=utf-8");
    return true;
  }
  if (pathname === "/app.js.map") {
    await serveFile(res, appJsMapPath, "application/json; charset=utf-8");
    return true;
  }
  return false;
}

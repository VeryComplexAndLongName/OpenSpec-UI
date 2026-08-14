// 2.1 Отдача браузерного шелла (packages/webui's standalone-entry.tsx,
// собранного scripts/build-client.mjs). Только 2 фиксированных пути — не
// полноценный статический файловый сервер (не нужен для этой цели, лишняя
// поверхность вроде защиты от directory traversal ни к чему для двух
// известных файлов).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";

/** Явные пути к статическим файлам — нужны, когда `server` встроен (забандлен)
 * в другой хост (например, `extension`'s CJS-бандл для опционального
 * локального сервера, см. optional-server.ts), где `import.meta.url` внутри
 * CJS-вывода — `undefined` (esbuild опустошает `import.meta` при `format:
 * "cjs"`), и путь "рядом с этим модулем" вычислить нельзя. Без явного
 * override используются пути по умолчанию (для standalone/тестов). */
export interface StaticAssetPaths {
  indexHtmlPath?: string;
  appJsPath?: string;
  appJsMapPath?: string;
}

/** Ленивое и защищённое вычисление дефолтных путей: в забандленном CJS
 * `import.meta.url` — `undefined`, и `fileURLToPath(undefined)` бросает
 * исключение. Если бы это вычислялось на верхнем уровне модуля (раньше так
 * и было), сам `import` этого файла падал бы ещё до того, как вызывающий
 * код успевал передать явный override (см. tasks.md 4.2, живой прогон
 * vscode-extension, где именно это и произошло). */
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

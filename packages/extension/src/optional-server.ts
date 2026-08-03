// 2.3 Опциональный режим: локальный `server` как дочерний процесс с
// динамическим портом, включается только явной настройкой
// (`openspec-ui.transport.localServer.enabled`, см. spec.md "Localhost
// server mode is optional and opt-in"). Переиспользует тот же пакет
// `@openspec-ui/server`, что и standalone-инструмент (см. design.md,
// "Decisions").

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import type { OpenSpecUiServer } from "@openspec-ui/server";

/** В реальном забандленном CJS-расширении (`scripts/build.mjs`, format:
 * "cjs") `__dirname` доступен и корректен. При выполнении из исходников
 * (юнит-тесты через vitest — реальный ESM, без бандла) `__dirname` не
 * определён — используется `import.meta.url`. `typeof __dirname` безопасен
 * для необъявленного идентификатора в обоих случаях (не бросает
 * ReferenceError), см. optional-server.test.ts. */
function extensionDistDir(): string {
  if (typeof __dirname !== "undefined") return __dirname;
  return path.dirname(fileURLToPath(import.meta.url));
}

export class OptionalServerManager {
  private server: OpenSpecUiServer | undefined;
  private address: AddressInfo | undefined;

  constructor(private readonly workspaceRoot: string) {}

  get isRunning(): boolean {
    return this.server !== undefined;
  }

  get baseUrl(): string | undefined {
    return this.address ? `http://127.0.0.1:${this.address.port}` : undefined;
  }

  async start(): Promise<string> {
    if (this.server && this.address) return this.baseUrl as string;
    const { createServer } = await import("@openspec-ui/server");
    const distDir = extensionDistDir();
    this.server = createServer({
      workspaceRoot: this.workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      // `import.meta.url`-относительные дефолты `static.ts` не работают внутри
      // забандленного CJS-расширения (см. scripts/build.mjs) — расширение
      // носит свою копию standalone-шелла в dist/standalone/.
      staticAssets: {
        indexHtmlPath: path.join(distDir, "standalone", "index.html"),
        appJsPath: path.join(distDir, "standalone", "app.js"),
        appJsMapPath: path.join(distDir, "standalone", "app.js.map"),
      },
    });
    this.address = await this.server.listen();
    return this.baseUrl as string;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await this.server.close();
    this.server = undefined;
    this.address = undefined;
  }
}

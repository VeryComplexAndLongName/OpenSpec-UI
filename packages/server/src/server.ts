// 1.3 Bind по умолчанию на `127.0.0.1`, порт конфигурируется (см. spec.md,
// "Server is localhost-only by default").

import { type Server as HttpServer, createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import { type AgentRunner, type AuditLog } from "@openspec-ui/core";
import {
  handleChangeEditorCreateRequest,
  handleChangeEditorReadRequest,
  handleChangeEditorSaveRequest,
  handleOpenSpecInitRequest,
  handleOverviewRequest,
  handleStatusJsonRequest,
  handleStatusRequest,
} from "./rest.js";
import { handleSocketMessage } from "./websocket.js";
import { tryServeStatic, type StaticAssetPaths } from "./static.js";

export interface ServerOptions {
  workspaceRoot: string;
  /** По умолчанию `127.0.0.1` — сервер не должен быть доступен из сети без
   * явного намерения пользователя (см. design.md, "Decisions"). */
  host?: string;
  port?: number;
  localLlmBaseUrl?: string;
  localLlmModel?: string;
  /**
   * Explicit opt-in: allow command cwd outside startup workspace root.
   * Keep false by default.
   */
  allowExternalCwd?: boolean;
  auditLog?: AuditLog;
  /** Только для тестов: подмена реестра `AgentRunner` вместо реальных
   * CLI-адаптеров (см. server.test.ts) — не используется в проде. */
  runners?: Map<string, AgentRunner>;
  /** Явные пути к index.html/app.js — нужны, когда `server` встроен в
   * забандленный CJS-хост (см. static.ts, `extension`'s optional-server.ts). */
  staticAssets?: StaticAssetPaths;
}

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4317;

export interface OpenSpecUiServer {
  listen(): Promise<AddressInfo>;
  close(): Promise<void>;
  readonly httpServer: HttpServer;
}

export function createServer(options: ServerOptions): OpenSpecUiServer {
  const runners = options.runners ?? new Map<string, AgentRunner>();

  const httpServer = createHttpServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/status") {
      void handleStatusRequest(req, res, runners);
      return;
    }
    if (req.method === "POST" && req.url === "/api/overview") {
      void handleOverviewRequest(req, res);
      return;
    }
    if (req.method === "POST" && (req.url === "/api/status-json" || req.url === "/api/command-json")) {
      void handleStatusJsonRequest(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-editor/create") {
      void handleChangeEditorCreateRequest(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-editor/read") {
      void handleChangeEditorReadRequest(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-editor/save") {
      void handleChangeEditorSaveRequest(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/openspec/init") {
      void handleOpenSpecInitRequest(req, res);
      return;
    }
    if (req.method === "GET" && req.url) {
      void tryServeStatic(req.url, res, options.staticAssets).then((served) => {
        if (!served) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "not found" }));
        }
      });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/api/ws" });
  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      handleSocketMessage(socket, raw.toString(), runners);
    });
  });

  return {
    httpServer,
    listen(): Promise<AddressInfo> {
      return new Promise((resolve) => {
        httpServer.listen(options.port ?? DEFAULT_PORT, options.host ?? DEFAULT_HOST, () => {
          resolve(httpServer.address() as AddressInfo);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        wss.close(() => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        });
      });
    },
  };
}

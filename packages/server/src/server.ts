// 1.3 Binds to `127.0.0.1` by default, port is configurable (see spec.md,
// "Server is localhost-only by default").

import { randomBytes, timingSafeEqual } from "node:crypto";
import { type IncomingMessage, type Server as HttpServer, createServer as createHttpServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { WebSocketServer } from "ws";
import { getCoreVersion, type AgentRunner, type AuditLog, WorkbenchRecoveryService } from "@openspec-ui/core";
import {
  handleAgentsDetectRequest,
  handleArchiveTasksTemplateRequest,
  handleChangeEditorCreateRequest,
  handleChangeEditorReadRequest,
  handleChangeEditorSaveRequest,
  handleChangeTimelineRequest,
  handleChangeTimelinesRequest,
  handleHarnessConfigReadChangeOverrideRequest,
  handleHarnessConfigResolveRequest,
  handleHarnessConfigWriteRequest,
  handleOpenSpecInitRequest,
  handleOverviewRequest,
  handleSprintReportRequest,
  handleStatusJsonRequest,
  handleStatusRequest,
  handleTemplatesCustomizeRequest,
  handleTemplatesDeleteRequest,
  handleTemplatesListRequest,
  handleTemplatesRenderRequest,
} from "./rest.js";
import { handleSocketMessage } from "./websocket.js";
import { tryServeStatic, type StaticAssetPaths } from "./static.js";
import {
  handleChangeRollbackRequest,
  handleProcessDetailsRequest,
  handleProcessRollbackRequest,
  handleProcessesCleanupRequest,
  handleProcessesListRequest,
} from "./recovery-rest.js";

export interface ServerOptions {
  workspaceRoot: string;
  /** Defaults to `127.0.0.1` — the server must not be reachable from the
   * network without the user's explicit intent (see design.md, "Decisions"). */
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
  /** Tests only: substitutes the `AgentRunner` registry instead of the
   * real CLI adapters (see server.test.ts) — not used in production. */
  runners?: Map<string, AgentRunner>;
  /** Explicit paths to index.html/app.js — needed when `server` is
   * embedded into a bundled CJS host (see static.ts, `extension`'s
   * optional-server.ts). */
  staticAssets?: StaticAssetPaths;
  accessToken?: string;
  maxPayloadBytes?: number;
}

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4317;
export const DEFAULT_MAX_PAYLOAD_BYTES = 1024 * 1024;

let cachedServerVersion: string | undefined;
/** Lazy, not a top-level constant — `createRequire(import.meta.url)` breaks
 * once this module is bundled into a different format. `server` is bundled
 * into the VS Code extension's CJS `dist/extension.js` for its optional
 * local-server mode (see `staticAssets` doc above, `extension`'s
 * `optional-server.ts`), where `import.meta.url` resolves to `undefined` —
 * confirmed live via `@openspec-ui/core`'s identical `getCoreVersion` fix. */
function getServerVersion(): string {
  if (cachedServerVersion === undefined) {
    cachedServerVersion = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
  }
  return cachedServerVersion;
}

export interface OpenSpecUiServer {
  listen(): Promise<AddressInfo>;
  close(): Promise<void>;
  readonly httpServer: HttpServer;
  readonly accessToken: string;
}

export function createServer(options: ServerOptions): OpenSpecUiServer {
  const runners = options.runners ?? new Map<string, AgentRunner>();
  const accessToken = options.accessToken ?? randomBytes(32).toString("base64url");
  const maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const requestPolicy = {
    maxPayloadBytes,
    isCwdAllowed(cwd: string): boolean {
      if (options.allowExternalCwd) return true;
      const resolved = path.resolve(cwd);
      return resolved === workspaceRoot || resolved.startsWith(`${workspaceRoot}${path.sep}`);
    },
  };
  const recoveryServices = new Map<string, Promise<WorkbenchRecoveryService>>();
  const resolveRecoveryService = (cwd: string): Promise<WorkbenchRecoveryService> => {
    const root = path.resolve(cwd);
    let service = recoveryServices.get(root);
    if (!service) {
      service = WorkbenchRecoveryService.open(root);
      recoveryServices.set(root, service);
    }
    return service;
  };

  const httpServer = createHttpServer((req, res) => {
    if (req.url?.startsWith("/api/")) {
      if (!hasValidToken(req, accessToken)) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      if (!hasAllowedOrigin(req)) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "origin is not allowed" }));
        return;
      }
      if (req.method === "POST" && !req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
        res.writeHead(415, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "content-type must be application/json" }));
        return;
      }
    }
    if (req.method === "POST" && req.url === "/api/status") {
      void handleStatusRequest(req, res, runners, requestPolicy);
      return;
    }
    if (req.method === "GET" && req.url === "/api/workspace-root") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ workspaceRoot }));
      return;
    }
    if (req.method === "GET" && req.url === "/api/versions") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ core: getCoreVersion(), server: getServerVersion() }));
      return;
    }
    if (req.method === "POST" && req.url === "/api/overview") {
      void handleOverviewRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && (req.url === "/api/status-json" || req.url === "/api/command-json")) {
      void handleStatusJsonRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-editor/create") {
      void handleChangeEditorCreateRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-editor/read") {
      void handleChangeEditorReadRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-editor/save") {
      void handleChangeEditorSaveRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-editor/archive-tasks-template") {
      void handleArchiveTasksTemplateRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-timeline") {
      void handleChangeTimelineRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/change-timelines") {
      void handleChangeTimelinesRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/sprint-report") {
      void handleSprintReportRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/templates/list") {
      void handleTemplatesListRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/templates/customize") {
      void handleTemplatesCustomizeRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/templates/render") {
      void handleTemplatesRenderRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/templates/delete") {
      void handleTemplatesDeleteRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/agents/detect") {
      void handleAgentsDetectRequest(req, res, requestPolicy, options.localLlmBaseUrl);
      return;
    }
    if (req.method === "POST" && req.url === "/api/harness-config/resolve") {
      void handleHarnessConfigResolveRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/harness-config/read-change-override") {
      void handleHarnessConfigReadChangeOverrideRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/harness-config/write") {
      void handleHarnessConfigWriteRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/openspec/init") {
      void handleOpenSpecInitRequest(req, res, requestPolicy);
      return;
    }
    if (req.method === "POST" && req.url === "/api/processes/list") {
      void handleProcessesListRequest(req, res, requestPolicy, resolveRecoveryService);
      return;
    }
    if (req.method === "POST" && req.url === "/api/processes/details") {
      void handleProcessDetailsRequest(req, res, requestPolicy, resolveRecoveryService);
      return;
    }
    if (req.method === "POST" && req.url === "/api/processes/rollback") {
      void handleProcessRollbackRequest(req, res, requestPolicy, resolveRecoveryService);
      return;
    }
    if (req.method === "POST" && req.url === "/api/processes/rollback-change") {
      void handleChangeRollbackRequest(req, res, requestPolicy, resolveRecoveryService);
      return;
    }
    if (req.method === "POST" && req.url === "/api/processes/cleanup") {
      void handleProcessesCleanupRequest(req, res, requestPolicy, resolveRecoveryService);
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

  const wss = new WebSocketServer({
    server: httpServer,
    path: "/api/ws",
    maxPayload: maxPayloadBytes,
    handleProtocols(protocols) {
      return protocols.has("openspec-ui") ? "openspec-ui" : false;
    },
    verifyClient(info, done) {
      done(hasValidWebSocketToken(info.req, accessToken) && hasAllowedOrigin(info.req), 401, "Unauthorized");
    },
  });
  wss.on("connection", (socket) => {
    socket.on("error", () => {
      socket.close();
    });
    socket.on("message", (raw) => {
      handleSocketMessage(socket, raw.toString(), runners, resolveRecoveryService);
    });
  });

  return {
    httpServer,
    accessToken,
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

function safeTokenEquals(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function hasValidToken(req: IncomingMessage, expected: string): boolean {
  const value = req.headers["x-openspec-ui-token"];
  return safeTokenEquals(Array.isArray(value) ? value[0] : value, expected);
}

function hasValidWebSocketToken(req: IncomingMessage, expected: string): boolean {
  const protocols = req.headers["sec-websocket-protocol"]?.split(",").map((value) => value.trim()) ?? [];
  const tokenProtocol = protocols.find((value) => value.startsWith("openspec-ui-token."));
  return safeTokenEquals(tokenProtocol?.slice("openspec-ui-token.".length), expected);
}

function hasAllowedOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === req.headers.host;
  } catch {
    return false;
  }
}

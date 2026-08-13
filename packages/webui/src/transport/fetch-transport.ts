// FetchTransport — используется standalone-инструментом и, опционально, VS
// Code extension'ом (см. ADR 0001, п.2 — локальный сервер как опциональный
// режим extension). Проводной протокол зафиксирован в
// `openspec/changes/standalone-app/design.md`:
//   - `status` — REST (`POST /api/status`), синхронный ответ с полным
//     списком событий этого запуска (команда быстрая, WS ради неё избыточен);
//   - `plan`/`implement`/`review`/`cancel` — единое WebSocket-соединение
//     (`/api/ws`): команда отправляется и её события приходят по одному и
//     тому же сокету.
// Это деталь ПРОВОДНОГО протокола именно этой реализации `Transport` — вызов
// `send`/`subscribe` для потребителя выглядит одинаково независимо от того,
// какой kind команды отправлен (см. spec.md shared-ui, "Компоненты не
// зависят от конкретного транспорта").

import { type Command, type Event, deserializeEvent } from "@openspec-ui/core/browser";
import type { Transport, Unsubscribe } from "./types.js";

export interface FetchTransportOptions {
  /** Базовый URL сервера, например http://localhost:4000. */
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
  webSocketCtor?: typeof WebSocket;
}

function toWebSocketUrl(baseUrl: string): string {
  return `${baseUrl.replace(/^http/, "ws")}/api/ws`;
}

export class FetchTransport implements Transport {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly WebSocketCtor: typeof WebSocket;
  private readonly accessToken: string;
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(event: Event) => void>();

  constructor(options: FetchTransportOptions) {
    this.baseUrl = options.baseUrl;
    this.accessToken = options.accessToken;
    if (options.fetchImpl) {
      this.fetchImpl = options.fetchImpl;
    } else {
      this.fetchImpl = fetch.bind(globalThis) as typeof fetch;
    }
    const ctor = options.webSocketCtor ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    if (!ctor) {
      throw new Error("FetchTransport: WebSocket недоступен в этом окружении и не передан явно");
    }
    this.WebSocketCtor = ctor;
  }

  send(command: Command): void {
    if (command.kind === "status" || command.kind === "list" || command.kind === "show" || command.kind === "validate") {
      this.sendDirectOverRest(command);
      return;
    }
    this.sendOverWebSocket(command);
  }

  private sendDirectOverRest(command: Command): void {
    this.dispatchIfValid({
      kind: "started",
      runId: command.runId,
      timestamp: new Date().toISOString(),
      command: command.kind,
      cwd: command.cwd,
    });

    this.fetchImpl(`${this.baseUrl}/api/command-json`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-openspec-ui-token": this.accessToken,
      },
      body: JSON.stringify(command),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data = (await res.json()) as { events?: unknown };
        const events = Array.isArray(data.events) ? data.events : [];
        for (const raw of events) {
          if (
            typeof raw === "object" &&
            raw !== null &&
            (raw as { kind?: unknown }).kind === "started" &&
            (raw as { runId?: unknown }).runId === command.runId
          ) {
            continue;
          }
          this.dispatchIfValid(raw);
        }
      })
      .catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.dispatchIfValid({
          kind: "failed",
          runId: command.runId,
          timestamp: new Date().toISOString(),
          reason: `direct command ${command.kind} failed: ${reason}`,
        });
        console.error(`[FetchTransport] failed to execute direct command ${command.kind}:`, err);
      });
  }

  private sendOverWebSocket(command: Command): void {
    const socket = this.ensureSocket();
    const payload = JSON.stringify(command);
    if (socket.readyState === this.WebSocketCtor.OPEN) {
      socket.send(payload);
    } else {
      socket.addEventListener("open", () => socket.send(payload), { once: true });
    }
  }

  private ensureSocket(): WebSocket {
    if (this.socket && this.socket.readyState !== this.WebSocketCtor.CLOSED) {
      return this.socket;
    }
    const socket = new this.WebSocketCtor(toWebSocketUrl(this.baseUrl), [
      "openspec-ui",
      `openspec-ui-token.${this.accessToken}`,
    ]);
    socket.addEventListener("message", (message: MessageEvent) => {
      const data = typeof message.data === "string" ? message.data : String(message.data);
      this.dispatchIfValid(data);
    });
    this.socket = socket;
    return socket;
  }

  private dispatchIfValid(raw: unknown): void {
    try {
      const event = typeof raw === "string" ? deserializeEvent(raw) : deserializeEvent(JSON.stringify(raw));
      for (const listener of this.listeners) listener(event);
    } catch {
      // Payload, не соответствующий протоколу, — консервативно игнорируется
      // (тот же принцип, что и в core/agents/shared.ts), не роняет поток.
    }
  }

  subscribe(onEvent: (event: Event) => void): Unsubscribe {
    this.listeners.add(onEvent);
    return () => {
      this.listeners.delete(onEvent);
      if (this.listeners.size === 0 && this.socket) {
        this.socket.close();
        this.socket = null;
      }
    };
  }
}

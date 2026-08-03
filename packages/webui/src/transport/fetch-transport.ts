// FetchTransport — REST (POST команд) + Server-Sent Events (поток событий).
// Используется standalone-инструментом и, опционально, VS Code extension'ом
// (см. ADR 0001, п.2 — локальный сервер как опциональный режим extension).

import { type Command, type Event, deserializeEvent } from "@openspec-ui/core";
import type { Transport, Unsubscribe } from "./types.js";

export interface FetchTransportOptions {
  /** Базовый URL сервера, например http://localhost:4000. */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  eventSourceCtor?: typeof EventSource;
}

export class FetchTransport implements Transport {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly EventSourceCtor: typeof EventSource;

  constructor(options: FetchTransportOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
    const ctor = options.eventSourceCtor ?? (globalThis as { EventSource?: typeof EventSource }).EventSource;
    if (!ctor) {
      throw new Error("FetchTransport: EventSource недоступен в этом окружении и не передан явно");
    }
    this.EventSourceCtor = ctor;
  }

  send(command: Command): void {
    this.fetchImpl(`${this.baseUrl}/api/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    }).catch((err: unknown) => {
      console.error("[FetchTransport] не удалось отправить команду:", err);
    });
  }

  subscribe(onEvent: (event: Event) => void): Unsubscribe {
    const source = new this.EventSourceCtor(`${this.baseUrl}/api/events`);
    const handler = (message: MessageEvent<string>) => {
      try {
        onEvent(deserializeEvent(message.data));
      } catch {
        // Payload, не соответствующий протоколу, — консервативно игнорируется
        // (тот же принцип, что и в core/agents/shared.ts), не роняет поток.
      }
    };
    source.addEventListener("message", handler as EventListener);
    return () => {
      source.removeEventListener("message", handler as EventListener);
      source.close();
    };
  }
}

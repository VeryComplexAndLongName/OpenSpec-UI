// MessageBridgeTransport — основной режим VS Code extension: Webview не
// делает fetch к localhost, а обменивается сообщениями с extension host'ом
// через `acquireVsCodeApi().postMessage`/`window.addEventListener('message')`
// (см. ADR 0001, п.2).

import { type Command, type Event, isEvent } from "@openspec-ui/core";
import type { Transport, Unsubscribe } from "./types.js";

/** Минимальный интерфейс объекта, возвращаемого `acquireVsCodeApi()`. Хост
 * (extension) вызывает `acquireVsCodeApi()` один раз и передаёт результат
 * сюда — сам `webui` эту глобальную функцию не вызывает. */
export interface VsCodeApiLike {
  postMessage(message: unknown): void;
}

/** Ровно те методы `EventTarget`, что нужны — совпадает структурно с
 * реальным `EventTarget`/`Window`, поэтому и то, и другое подходит без
 * дополнительных приведений типов на стороне вызывающего кода. */
type EventTargetLike = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export interface MessageBridgeTransportOptions {
  vscodeApi: VsCodeApiLike;
  /** По умолчанию — глобальный `window`; подставляется в тестах. */
  eventTarget?: EventTargetLike;
}

const COMMAND_MESSAGE_TYPE = "openspec-ui/command";
const EVENT_MESSAGE_TYPE = "openspec-ui/event";

interface BridgeEventMessage {
  type: typeof EVENT_MESSAGE_TYPE;
  event: Event;
}

function isBridgeEventMessage(data: unknown): data is BridgeEventMessage {
  if (typeof data !== "object" || data === null) return false;
  const v = data as Record<string, unknown>;
  return v.type === EVENT_MESSAGE_TYPE && isEvent(v.event);
}

export class MessageBridgeTransport implements Transport {
  private readonly vscodeApi: VsCodeApiLike;
  private readonly eventTarget: EventTargetLike;

  constructor(options: MessageBridgeTransportOptions) {
    this.vscodeApi = options.vscodeApi;
    this.eventTarget = options.eventTarget ?? window;
  }

  send(command: Command): void {
    this.vscodeApi.postMessage({ type: COMMAND_MESSAGE_TYPE, command });
  }

  subscribe(onEvent: (event: Event) => void): Unsubscribe {
    const handler = (message: MessageEvent) => {
      if (isBridgeEventMessage(message.data)) {
        onEvent(message.data.event);
      }
    };
    this.eventTarget.addEventListener("message", handler as EventListener);
    return () => {
      this.eventTarget.removeEventListener("message", handler as EventListener);
    };
  }
}

// MessageBridgeTransport — the primary mode for the VS Code extension: the
// Webview does not fetch localhost, it exchanges messages with the
// extension host via
// `acquireVsCodeApi().postMessage`/`window.addEventListener('message')`
// (see ADR 0001, item 2).

import { type Command, type Event, isEvent } from "@openspec-ui/core/browser";
import type { Transport, Unsubscribe } from "./types.js";

/** Minimal interface for the object returned by `acquireVsCodeApi()`. The
 * host (extension) calls `acquireVsCodeApi()` once and passes the result
 * in here — `webui` itself never calls this global function. */
export interface VsCodeApiLike {
  postMessage(message: unknown): void;
}

/** Exactly the `EventTarget` methods that are needed — structurally
 * matches the real `EventTarget`/`Window`, so either one fits without
 * extra type casts on the calling side. */
type EventTargetLike = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export interface MessageBridgeTransportOptions {
  vscodeApi: VsCodeApiLike;
  /** Defaults to the global `window`; substituted in tests. */
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

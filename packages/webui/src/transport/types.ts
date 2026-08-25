// Transport is the single boundary beyond which `webui` components do not
// know whether they are running in the browser (standalone) or in a
// Webview (VS Code extension). Components call only this interface, never
// `fetch`/`postMessage` directly (see spec.md, "Components do not depend
// on a specific transport").

import type { Command, Event } from "@openspec-ui/core";

export type Unsubscribe = () => void;

export interface Transport {
  /** Sends a command. Does not return a result directly — the result
   * arrives as a stream of events through `subscribe` (see design.md: a
   * single event-driven protocol, not request/response). */
  send(command: Command): void;
  /** Subscribes to ALL events received by this transport (events from
   * different `runId`s may arrive concurrently — the consumer filters
   * them itself). Returns an unsubscribe function. */
  subscribe(onEvent: (event: Event) => void): Unsubscribe;
}

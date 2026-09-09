// Asking the extension host a question over the webview bridge.
//
// The bridge carries a `Command` one way and a stream of `Event`s the
// other; neither shape is a question with an answer. The run dialog
// needed none — its plan arrived as context and a choice went back
// one-way — so the settings view is the first thing here that has to
// read something. See harness-settings-in-the-panel.
//
// One id per call, resolved against a pending map: two requests in
// flight are ordinary (the settings view loads the global config and the
// custom agents at once), and a channel that assumed one would answer
// the wrong caller.

export const BRIDGE_REQUEST_MESSAGE_TYPE = "openspec-ui/request";
export const BRIDGE_RESPONSE_MESSAGE_TYPE = "openspec-ui/response";

/** What the host offers. Named operations, never a path, a file or a
 * function name: a message must not be able to say what gets read or
 * written. */
export type BridgeOperation =
    | "harness/resolve-global"
    | "harness/write-global"
    | "harness/read-change-override"
    | "harness/write-change-override"
    | "custom-agents/list";

export interface BridgeRequestMessage {
    type: typeof BRIDGE_REQUEST_MESSAGE_TYPE;
    id: string;
    op: BridgeOperation;
    args?: unknown;
}

export interface BridgeResponseMessage {
    type: typeof BRIDGE_RESPONSE_MESSAGE_TYPE;
    id: string;
    ok: boolean;
    value?: unknown;
    /** Present when `ok` is false. Carried rather than swallowed: a form
     * that cannot say a save was refused is indistinguishable from one
     * that saved. */
    error?: string;
}

export function isBridgeResponseMessage(value: unknown): value is BridgeResponseMessage {
    if (typeof value !== "object" || value === null) return false;
    const message = value as Record<string, unknown>;
    return message.type === BRIDGE_RESPONSE_MESSAGE_TYPE
        && typeof message.id === "string"
        && typeof message.ok === "boolean";
}

export interface BridgePoster {
    postMessage(message: unknown): void;
}

export interface EventTargetLike {
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
}

/** Opens the channel. Returns the asking function and the unsubscribe
 * that stops listening — the caller owns both, the same shape
 * `MessageBridgeTransport.subscribe` already uses here. */
export function createBridgeRequester(
    poster: BridgePoster,
    eventTarget: EventTargetLike = window,
): { request: <T>(op: BridgeOperation, args?: unknown) => Promise<T>; dispose: () => void } {
    const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
    let nextId = 0;

    const handler = (event: Event): void => {
        const data = (event as MessageEvent<unknown>).data;
        if (!isBridgeResponseMessage(data)) return;
        const waiting = pending.get(data.id);
        if (!waiting) return;
        pending.delete(data.id);
        if (data.ok) waiting.resolve(data.value);
        // A refusal reaching the caller as a rejection is the whole point
        // of the channel having two outcomes.
        else waiting.reject(new Error(data.error ?? "the request was refused"));
    };
    eventTarget.addEventListener("message", handler as EventListener);

    return {
        request<T>(op: BridgeOperation, args?: unknown): Promise<T> {
            const id = `${op}:${nextId++}`;
            return new Promise<T>((resolve, reject) => {
                pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
                poster.postMessage({ type: BRIDGE_REQUEST_MESSAGE_TYPE, id, op, ...(args === undefined ? {} : { args }) });
            });
        },
        dispose(): void {
            eventTarget.removeEventListener("message", handler as EventListener);
            // Nothing will answer these now. Left pending they would be
            // promises that never settle, which is worse than an error.
            for (const waiting of pending.values()) waiting.reject(new Error("the panel closed before an answer arrived"));
            pending.clear();
        },
    };
}

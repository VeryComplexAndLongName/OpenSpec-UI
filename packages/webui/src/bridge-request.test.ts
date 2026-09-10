import { afterEach, describe, expect, it, vi } from "vitest";
import {
    BRIDGE_REQUEST_TIMEOUT_MS,
    BRIDGE_RESPONSE_MESSAGE_TYPE,
    createBridgeRequester,
    type BridgeRequestMessage,
} from "./bridge-request.js";

// harness-settings-in-the-panel:
// pure over an in-memory event target — no panel, no host.

function createChannel(timeoutMs?: number) {
    const target = new EventTarget();
    const posted: BridgeRequestMessage[] = [];
    const poster = { postMessage: (message: unknown) => { posted.push(message as BridgeRequestMessage); } };
    const channel = createBridgeRequester(poster, target, timeoutMs);
    const answer = (id: string, body: Record<string, unknown>): void => {
        target.dispatchEvent(Object.assign(new Event("message"), {
            data: { type: BRIDGE_RESPONSE_MESSAGE_TYPE, id, ...body },
        }));
    };
    return { channel, posted, answer };
}

describe("createBridgeRequester", () => {
    it("resolves a request with the answer that carries its id", async () => {
        const { channel, posted, answer } = createChannel();

        const pending = channel.request<{ autonomyLevel: string }>("harness/resolve-global");
        answer(posted[0]!.id, { ok: true, value: { autonomyLevel: "assisted" } });

        expect(await pending).toEqual({ autonomyLevel: "assisted" });
        expect(posted[0]!.op).toBe("harness/resolve-global");
    });

    it("answers each of two requests in flight against its own id", async () => {
        // Ordinary here: the settings view loads the configuration and
        // the custom agents at once, and a channel assuming one request
        // would answer the wrong caller.
        const { channel, posted, answer } = createChannel();

        const first = channel.request<string>("harness/resolve-global");
        const second = channel.request<string>("custom-agents/list");
        answer(posted[1]!.id, { ok: true, value: "agents" });
        answer(posted[0]!.id, { ok: true, value: "config" });

        expect(await first).toBe("config");
        expect(await second).toBe("agents");
    });

    it("rejects with the reason when the host refuses", async () => {
        // A form that cannot say a save was refused is
        // indistinguishable from one that saved.
        const { channel, posted, answer } = createChannel();

        const pending = channel.request("harness/write-global", { config: {} });
        answer(posted[0]!.id, { ok: false, error: "reviewGate.mode is not accepted globally" });

        await expect(pending).rejects.toThrow("reviewGate.mode is not accepted globally");
    });

    it("rejects a refusal that carries no reason rather than resolving it", async () => {
        const { channel, posted, answer } = createChannel();

        const pending = channel.request("harness/write-global");
        answer(posted[0]!.id, { ok: false });

        await expect(pending).rejects.toThrow("refused");
    });

    it("ignores an answer to a request it is not waiting for", async () => {
        const { channel, posted, answer } = createChannel();
        const pending = channel.request<string>("harness/resolve-global");

        answer("not-a-pending-id", { ok: true, value: "wrong" });
        answer(posted[0]!.id, { ok: true, value: "right" });

        expect(await pending).toBe("right");
    });

    it("settles what is still waiting when the channel is disposed", async () => {
        // A promise that never settles is worse than an error: the form
        // would sit on "Working..." forever.
        const { channel } = createChannel();
        const pending = channel.request("harness/resolve-global");

        channel.dispose();

        await expect(pending).rejects.toThrow("closed");
    });

    it("stops listening once disposed", () => {
        const target = new EventTarget();
        const remove = vi.spyOn(target, "removeEventListener");
        const channel = createBridgeRequester({ postMessage: () => {} }, target);

        channel.dispose();

        expect(remove).toHaveBeenCalled();
    });
});

describe("createBridgeRequester — a request nobody answers", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("rejects after the interval, naming the operation and the time", async () => {
        // The host replies on every path it knows, so this is the panel
        // that died or the request posted before the listener attached.
        // Left unsettled it pins the settings form on "Working..." with
        // the save button disabled and nothing said. See
        // a-check-that-passes-checked-something.
        vi.useFakeTimers();
        const { channel } = createChannel(5_000);

        const pending = channel.request("harness/resolve-global");
        const settled = expect(pending).rejects
            .toThrow("the host did not reply within 5 seconds to harness/resolve-global");
        await vi.advanceTimersByTimeAsync(5_000);
        await settled;
    });

    it("does not reject one millisecond early", async () => {
        vi.useFakeTimers();
        const { channel, posted, answer } = createChannel(5_000);

        const pending = channel.request<string>("harness/resolve-global");
        await vi.advanceTimersByTimeAsync(4_999);
        answer(posted[0]!.id, { ok: true, value: "in time" });

        expect(await pending).toBe("in time");
    });

    it("ignores a reply that arrives after the rejection", async () => {
        vi.useFakeTimers();
        const { channel, posted, answer } = createChannel(5_000);

        const pending = channel.request("harness/resolve-global");
        const settled = expect(pending).rejects.toThrow("did not reply");
        await vi.advanceTimersByTimeAsync(5_000);
        await settled;

        // A late host is not an error to report to anybody: the caller
        // has already been told, and there is nothing left waiting.
        expect(() => answer(posted[0]!.id, { ok: true, value: "late" })).not.toThrow();
    });

    it("stops the clock when the answer arrives", async () => {
        // A timer left running after a settled request fires into an
        // empty map — harmless, but it also keeps a handle alive for the
        // whole interval, which is what `dispose` exists to avoid.
        vi.useFakeTimers();
        const { channel, posted, answer } = createChannel(5_000);

        const pending = channel.request<string>("harness/resolve-global");
        answer(posted[0]!.id, { ok: true, value: "answered" });
        await pending;

        expect(vi.getTimerCount()).toBe(0);
    });

    it("stops the clocks of everything still waiting when disposed", async () => {
        vi.useFakeTimers();
        const { channel } = createChannel(5_000);
        const pending = channel.request("harness/resolve-global");
        const settled = expect(pending).rejects.toThrow("closed");

        channel.dispose();

        await settled;
        expect(vi.getTimerCount()).toBe(0);
    });

    it("states a default interval, so a caller that names none still gets one", () => {
        expect(BRIDGE_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    });
});

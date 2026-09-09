import { describe, expect, it, vi } from "vitest";
import {
    BRIDGE_RESPONSE_MESSAGE_TYPE,
    createBridgeRequester,
    type BridgeRequestMessage,
} from "./bridge-request.js";

// harness-settings-in-the-panel:
// pure over an in-memory event target — no panel, no host.

function createChannel() {
    const target = new EventTarget();
    const posted: BridgeRequestMessage[] = [];
    const poster = { postMessage: (message: unknown) => { posted.push(message as BridgeRequestMessage); } };
    const channel = createBridgeRequester(poster, target);
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

import { describe, expect, it, vi } from "vitest";
import { readChangeHarnessOverride, resolveHarnessConfig, writeHarnessConfig } from "./harness-config-client.js";

describe("resolveHarnessConfig", () => {
  it("posts cwd (and changeName, when given) and returns the resolved config", async () => {
    const payload = {
      stepAgents: { propose: "claude-cli" },
      autonomyLevel: "assisted",
      reviewGate: { mode: "human-required" },
    };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await expect(resolveHarnessConfig(request, "/workspace", "demo")).resolves.toEqual(payload);
    expect(request.mock.calls[0]?.[0]).toBe("/api/harness-config/resolve");
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      cwd: "/workspace",
      changeName: "demo",
    });
  });

  it("omits changeName from the body when not given", async () => {
    const payload = { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await resolveHarnessConfig(request, "/workspace");

    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      cwd: "/workspace",
      changeName: undefined,
    });
  });

  it("throws with the server-provided error message on a malformed config (422)", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid harness config: ..." }), { status: 422 }),
    );

    await expect(resolveHarnessConfig(request, "/workspace")).rejects.toThrow("Invalid harness config");
  });
});

describe("readChangeHarnessOverride", () => {
  it("returns the raw override object", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ override: { reviewGate: { mode: "agent-sufficient" } } }), { status: 200 }),
    );

    await expect(readChangeHarnessOverride(request, "/workspace", "demo")).resolves.toEqual({
      reviewGate: { mode: "agent-sufficient" },
    });
    expect(request.mock.calls[0]?.[0]).toBe("/api/harness-config/read-change-override");
  });

  it("returns null when no override file exists", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ override: null }), { status: 200 }));

    await expect(readChangeHarnessOverride(request, "/workspace", "demo")).resolves.toBeNull();
  });
});

describe("writeHarnessConfig", () => {
  it("posts cwd, config, and omits changeName for a global write", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ written: true }), { status: 200 }));

    await writeHarnessConfig(request, "/workspace", { stepAgents: { propose: "claude-cli" } });

    expect(request.mock.calls[0]?.[0]).toBe("/api/harness-config/write");
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      cwd: "/workspace",
      changeName: undefined,
      config: { stepAgents: { propose: "claude-cli" } },
    });
  });

  it("includes changeName for a per-change write", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ written: true }), { status: 200 }));

    await writeHarnessConfig(request, "/workspace", { reviewGate: { mode: "agent-sufficient" } }, "demo");

    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      cwd: "/workspace",
      changeName: "demo",
      config: { reviewGate: { mode: "agent-sufficient" } },
    });
  });

  it("throws with the server-provided error message on failure", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid harness config: bad agent id" }), { status: 422 }),
    );

    await expect(writeHarnessConfig(request, "/workspace", {})).rejects.toThrow("Invalid harness config");
  });
});

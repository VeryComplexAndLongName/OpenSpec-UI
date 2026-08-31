import { describe, expect, it, vi } from "vitest";
import { resolveRunWithHarnessDispatch } from "./run-with-harness-dispatch.js";

function fakeRequest(config: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(config), { status: 200 }));
}

describe("resolveRunWithHarnessDispatch", () => {
  it("targets the picker for assisted, and computes the change's directory", async () => {
    const request = fakeRequest({ stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } });

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result).toEqual({ target: "picker", changeDir: "/repo/openspec/changes/demo" });
    expect(request.mock.calls[0]?.[0]).toBe("/api/harness-config/resolve");
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      cwd: "/repo",
      changeName: "demo",
    });
  });

  it("targets a chain for semi-autonomous", async () => {
    const request = fakeRequest({ stepAgents: {}, autonomyLevel: "semi-autonomous", reviewGate: { mode: "human-required" } });

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result.target).toBe("chain");
  });

  it("targets a chain for autonomous", async () => {
    const request = fakeRequest({ stepAgents: {}, autonomyLevel: "autonomous", reviewGate: { mode: "human-required" } });

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result.target).toBe("chain");
  });

  it("uses backslash separators for a Windows-style cwd", async () => {
    const request = fakeRequest({ stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } });

    const result = await resolveRunWithHarnessDispatch(request, "C:\\repo", "demo");

    expect(result.changeDir).toBe("C:\\repo\\openspec\\changes\\demo");
  });

  it("propagates a resolution error instead of swallowing it", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid harness config: ..." }), { status: 422 }),
    );

    await expect(resolveRunWithHarnessDispatch(request, "/repo", "demo")).rejects.toThrow("Invalid harness config");
  });
});

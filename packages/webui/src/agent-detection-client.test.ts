import { describe, expect, it, vi } from "vitest";
import { detectAgents } from "./agent-detection-client.js";

describe("detectAgents", () => {
  it("posts cwd and returns the agents map", async () => {
    const payload = { agents: { "claude-cli": true, "copilot-cli": false } };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await expect(detectAgents(request, "/workspace")).resolves.toEqual(payload.agents);
    expect(request.mock.calls[0]?.[0]).toBe("/api/agents/detect");
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({ cwd: "/workspace" });
  });

  it("throws with the server-provided error message on failure", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "cwd is outside the configured workspace" }), { status: 403 }),
    );

    await expect(detectAgents(request, "/outside")).rejects.toThrow("cwd is outside the configured workspace");
  });
});

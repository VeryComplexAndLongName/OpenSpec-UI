import { describe, expect, it, vi } from "vitest";
import { loadChangeTimeline, loadChangeTimelines, type ChangeTimeline } from "./change-timeline-client.js";

const timeline: ChangeTimeline = {
  changeName: "my-change",
  archived: false,
  createdDate: "2026-01-01T00:00:00.000Z",
  archivedDate: null,
  proposal: "## Why\n",
  design: "## Context\n",
  specs: [],
  tasks: [
    {
      lineNumber: 0,
      text: "done",
      done: true,
      date: "2026-01-02T00:00:00.000Z",
      lastTouchedDate: "2026-01-02T00:00:00.000Z",
    },
  ],
};

describe("loadChangeTimeline", () => {
  it("posts cwd, changeName, and archived, and returns the parsed timeline", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(timeline), { status: 200 }));

    await expect(loadChangeTimeline(request, "/workspace", "my-change", false)).resolves.toEqual(timeline);
    expect(request.mock.calls[0]?.[0]).toBe("/api/change-timeline");
    const requestInit = request.mock.calls[0]?.[1];
    if (!requestInit) throw new Error("change-timeline request was not captured");
    expect(JSON.parse(requestInit.body as string)).toEqual({
      cwd: "/workspace",
      changeName: "my-change",
      archived: false,
    });
  });

  it("throws with the server-provided error message on failure", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "change not found" }), { status: 404 }),
    );

    await expect(loadChangeTimeline(request, "/workspace", "missing", false)).rejects.toThrow(
      "change not found",
    );
  });
});

describe("loadChangeTimelines", () => {
  it("posts cwd and entries, and returns the parsed timeline array", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify([timeline]), { status: 200 }));
    const entries = [{ changeName: "my-change", archived: false }];

    await expect(loadChangeTimelines(request, "/workspace", entries)).resolves.toEqual([timeline]);
    expect(request.mock.calls[0]?.[0]).toBe("/api/change-timelines");
    const requestInit = request.mock.calls[0]?.[1];
    if (!requestInit) throw new Error("change-timelines request was not captured");
    expect(JSON.parse(requestInit.body as string)).toEqual({ cwd: "/workspace", entries });
  });
});

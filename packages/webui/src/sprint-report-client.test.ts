import { describe, expect, it, vi } from "vitest";
import { fetchSprintReport } from "./sprint-report-client.js";

describe("fetchSprintReport", () => {
  it("posts cwd, entries, and the date range, and returns the summary", async () => {
    const report = { rangeStart: "2026-01-01T00:00:00.000Z", rangeEnd: "2026-01-14T00:00:00.000Z", entries: [], stats: { totalChanges: 0, totalTasksCompletedInRange: 0, changesByAuthor: [] } };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(report), { status: 200, headers: { "content-type": "application/json" } }));
    const entries = [{ changeName: "my-change", archived: false }];

    const result = await fetchSprintReport(
      request,
      "/workspace",
      entries,
      "2026-01-01T00:00:00.000Z",
      "2026-01-14T00:00:00.000Z",
    );

    expect(result.rangeStart).toBe("2026-01-01T00:00:00.000Z");
    expect(request.mock.calls[0]?.[0]).toBe("/api/sprint-report");
    const requestInit = request.mock.calls[0]?.[1];
    if (!requestInit) throw new Error("sprint-report request was not captured");
    expect(JSON.parse(requestInit.body as string)).toEqual({
      cwd: "/workspace",
      entries,
      rangeStart: "2026-01-01T00:00:00.000Z",
      rangeEnd: "2026-01-14T00:00:00.000Z",
    });
  });

  it("throws with the server-provided error message on failure", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid date range" }), { status: 400 }),
    );

    await expect(
      fetchSprintReport(request, "/workspace", [], "bad", "bad"),
    ).rejects.toThrow("invalid date range");
  });
});

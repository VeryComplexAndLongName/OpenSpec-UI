import { describe, expect, it, vi } from "vitest";
import { fetchSprintReportPdf } from "./sprint-report-client.js";

describe("fetchSprintReportPdf", () => {
  it("posts cwd, entries, and the date range, and returns the response body as a Blob", async () => {
    const pdfBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" });
    const request = vi.fn().mockResolvedValue(new Response(pdfBlob, { status: 200 }));
    const entries = [{ changeName: "my-change", archived: false }];

    const result = await fetchSprintReportPdf(
      request,
      "/workspace",
      entries,
      "2026-01-01T00:00:00.000Z",
      "2026-01-14T00:00:00.000Z",
    );

    expect(result).toBeInstanceOf(Blob);
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
      fetchSprintReportPdf(request, "/workspace", [], "bad", "bad"),
    ).rejects.toThrow("invalid date range");
  });
});

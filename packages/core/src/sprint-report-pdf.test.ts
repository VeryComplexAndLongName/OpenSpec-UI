import { describe, expect, it } from "vitest";
import { renderSprintReportPdf } from "./sprint-report-pdf.js";
import type { SprintReport } from "./sprint-report.js";

const report: SprintReport = {
  rangeStart: "2026-01-01T00:00:00.000Z",
  rangeEnd: "2026-01-14T00:00:00.000Z",
  entries: [
    {
      changeName: "add-widget",
      archived: true,
      createdDate: "2026-01-02T00:00:00.000Z",
      archivedDate: "2026-01-05",
      whySummary: "Because widgets were needed.",
      completedTaskCount: 3,
      totalTaskCount: 3,
      tasksCompletedInRange: 3,
      primaryAuthor: { name: "Alice", email: "alice@example.com", date: "2026-01-05T00:00:00.000Z" },
      contributors: [{ name: "Alice", email: "alice@example.com", date: "2026-01-05T00:00:00.000Z" }],
    },
  ],
  stats: {
    totalChanges: 1,
    totalTasksCompletedInRange: 3,
    changesByAuthor: [
      { author: { name: "Alice", email: "alice@example.com", date: "2026-01-05T00:00:00.000Z" }, count: 1 },
    ],
  },
};

describe("renderSprintReportPdf", () => {
  it("renders a real PDF document", async () => {
    const buffer = await renderSprintReportPdf(report);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-6).toString("latin1")).toBe("%%EOF\n");
  });

  it("renders an empty report without throwing", async () => {
    const empty: SprintReport = {
      rangeStart: "2026-01-01T00:00:00.000Z",
      rangeEnd: "2026-01-14T00:00:00.000Z",
      entries: [],
      stats: { totalChanges: 0, totalTasksCompletedInRange: 0, changesByAuthor: [] },
    };

    const buffer = await renderSprintReportPdf(empty);

    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

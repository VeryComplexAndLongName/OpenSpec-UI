import { describe, expect, it } from "vitest";
import { formatDay, summaryFigures, type SummaryOverview } from "./summary-figures.js";

const OVERVIEW: SummaryOverview = {
  changes: [
    { name: "alpha", completedTasks: 25, totalTasks: 27, lastModified: "2026-09-16T14:15:49.168Z" },
    { name: "beta", completedTasks: 0, totalTasks: 25 },
  ],
  specs: [
    { id: "shared-ui", requirementCount: 59 },
    { id: "agentic-harness", requirementCount: 102 },
    { id: "ci-cli", requirementCount: 31 },
    { id: "execution-core", requirementCount: 59 },
    { id: "direct-openspec-mode", requirementCount: 3 },
    { id: "vscode-extension", requirementCount: 30 },
    { id: "template-catalog", requirementCount: 8 },
  ],
  archivedChangeSummaries: [
    { name: "2026-09-14-a-run-says-which-task-it-is-on", completedTasks: 29, totalTasks: 29, lastModified: "2026-09-14T01:47:16Z" },
    { name: "2026-09-16-the-web-ui-wears-more-metro", completedTasks: 20, totalTasks: 20, lastModified: "2026-09-16T09:33:59Z" },
    { name: "2026-09-15-the-web-ui-wears-metro", completedTasks: 19, totalTasks: 19, lastModified: "2026-09-15T04:14:00Z" },
    { name: "2026-09-15-an-artifact-label-says-what-it-is", completedTasks: 11, totalTasks: 11, lastModified: "2026-09-15T15:48:00Z" },
    { name: "2026-09-13-what-the-others-are-doing", completedTasks: 47, totalTasks: 47, lastModified: "2026-09-13T12:01:00Z" },
    { name: "2026-09-15-the-docs-catch-up-to-0-55", completedTasks: 19, totalTasks: 19, lastModified: "2026-09-15T02:04:40Z" },
  ],
};

// the-summary-looks-like-the-mockup 1.2 and 1.3
describe("summaryFigures", () => {
  it("gives the four tiles their figures and notes", () => {
    const { tiles } = summaryFigures(OVERVIEW, [{ waitingOn: { kind: "person" } }, { waitingOn: { kind: "agent" } }]);

    expect(tiles).toEqual([
      { key: "changes", label: "Changes", value: 2, note: "active" },
      { key: "archived", label: "Archived", value: 6, note: "latest 16 Sep" },
      { key: "specs", label: "Specs", value: 7, note: "292 requirements" },
      { key: "waiting", label: "Waiting on you", value: 1, note: "1 item to look at" },
    ]);
  });

  it("lists the six specs with the most requirements, and the five latest archived changes by the day in their name", () => {
    const { topSpecs, recentlyArchived } = summaryFigures(OVERVIEW, null);

    expect(topSpecs.map((spec) => spec.id)).toEqual(["agentic-harness", "execution-core", "shared-ui", "ci-cli", "vscode-extension", "template-catalog"]);
    expect(recentlyArchived.map((change) => [change.title, change.day])).toEqual([
      ["the-web-ui-wears-more-metro", "2026-09-16"],
      ["an-artifact-label-says-what-it-is", "2026-09-15"],
      ["the-docs-catch-up-to-0-55", "2026-09-15"],
      ["the-web-ui-wears-metro", "2026-09-15"],
      ["a-run-says-which-task-it-is-on", "2026-09-14"],
    ]);
  });

  it("says so for an empty workspace, and for an inbox not yet read", () => {
    const { tiles } = summaryFigures({ changes: [], specs: [], archivedChangeSummaries: [] }, null);

    expect(tiles.map((tile) => [tile.value, tile.note])).toEqual([[0, "active"], [0, "none yet"], [0, "0 requirements"], ["…", "not read yet"]]);
    expect(summaryFigures({ changes: [], specs: [], archivedChangeSummaries: [] }, []).tiles[3]).toMatchObject({ value: 0, note: "nothing is waiting" });
  });
});

describe("formatDay", () => {
  it("reads a bare day as that calendar day, a timestamp in the viewer's zone, and leaves anything else as it is", () => {
    expect(formatDay("2026-09-16")).toBe("16 Sep");
    expect(formatDay("2026-01-05")).toBe("5 Jan");
    const stamp = new Date(2026, 8, 13, 23, 16);
    expect(formatDay(stamp.toISOString())).toBe("13 Sep");
    expect(formatDay("not a date")).toBe("not a date");
  });
});

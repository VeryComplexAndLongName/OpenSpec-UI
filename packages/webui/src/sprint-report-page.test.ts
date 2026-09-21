import { describe, expect, it } from "vitest";
import type { SprintReport } from "@openspec-ui/core/browser";
import { escapeHtml, renderSprintReportNotice, renderSprintReportPage } from "./sprint-report-page.js";

// the-sprint-report-is-a-page-of-the-product 1.6. The figures are core's;
// these assert the page carries them, that nothing from the repository
// becomes markup, and that the document stands on its own.

const AUTHOR = { name: "Alexander Ivanov", email: "owner@example.com", date: "2026-09-18T10:00:00.000Z" };

const REPORT: SprintReport = {
  rangeStart: "2026-09-14T00:00:00.000Z",
  rangeEnd: "2026-09-20T00:00:00.000Z",
  entries: [
    {
      changeName: "a-run-budget-has-a-unit",
      archived: false,
      createdDate: "2026-09-15T09:00:00.000Z",
      archivedDate: null,
      whySummary: "A budget without a unit is a number nobody can check.",
      completedTaskCount: 7,
      totalTaskCount: 9,
      tasksCompletedInRange: 5,
      primaryAuthor: AUTHOR,
      contributors: [AUTHOR],
    },
    {
      changeName: "a-tour-is-recorded",
      archived: true,
      createdDate: "2026-09-10T09:00:00.000Z",
      archivedDate: "2026-09-19T09:00:00.000Z",
      whySummary: "",
      completedTaskCount: 4,
      totalTaskCount: 4,
      tasksCompletedInRange: 4,
      primaryAuthor: null,
      contributors: [],
    },
  ],
  stats: {
    totalChanges: 2,
    totalTasksCompletedInRange: 9,
    changesByAuthor: [{ author: AUTHOR, count: 1 }],
  },
};

describe("the sprint report page", () => {
  it("carries every figure the report holds", () => {
    const page = renderSprintReportPage(REPORT);

    expect(page).toContain("2026-09-14 to 2026-09-20");
    expect(page).toContain("a-run-budget-has-a-unit");
    expect(page).toContain("7/9 tasks done, 5 in this sprint");
    expect(page).toContain("A budget without a unit is a number nobody can check.");
    expect(page).toContain("Created 2026-09-15");
    expect(page).toContain("Archived 2026-09-19");
    expect(page).toContain("2 changes");
    expect(page).toContain("9 tasks completed within this sprint");
    expect(page).toContain("1 change");
  });

  it("draws each change's state as the product's own badge", () => {
    const page = renderSprintReportPage(REPORT);

    expect(page).toContain('<span class="openspec-change-state openspec-change-state--in-progress">Active</span>');
    expect(page).toContain('<span class="openspec-change-state">Archived</span>');
  });

  it("says where authorship could not be determined, rather than leaving a gap", () => {
    const page = renderSprintReportPage(REPORT);

    expect(page).toContain("unknown");
  });

  it("stands on its own: one document, carrying its styles", () => {
    const page = renderSprintReportPage(REPORT);

    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain("<style>");
    // The product's own sheet, not a second one written for the report.
    expect(page).toContain("--heading:");
    expect(page).toContain("openspec-metro-icons");
    // Nothing to fetch: no stylesheet link, no script file.
    expect(page).not.toContain('<link rel="stylesheet"');
    expect(page).not.toContain("<script src=");
  });

  it("gives paper its own rules, and does not split a change across a page", () => {
    const page = renderSprintReportPage(REPORT);

    expect(page).toContain("@media print");
    expect(page).toContain("break-inside: avoid");
  });

  it("cannot be made to carry markup from the repository", () => {
    const hostile: SprintReport = {
      ...REPORT,
      entries: [{
        ...(REPORT.entries[0] as SprintReport["entries"][number]),
        changeName: "<script>alert(1)</script>",
        whySummary: "a quote \" and an ampersand & and <b>bold</b>",
        primaryAuthor: { name: "<img src=x onerror=1>", email: "who@example.com", date: AUTHOR.date },
      }],
    };

    const page = renderSprintReportPage(hostile);

    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).not.toContain("<img src=x");
    expect(page).not.toContain("<b>bold</b>");
    expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("says so when there is nothing in the range", () => {
    const page = renderSprintReportPage({ ...REPORT, entries: [], stats: { totalChanges: 0, totalTasksCompletedInRange: 0, changesByAuthor: [] } });

    expect(page).toContain("No changes in this report.");
    expect(page).toContain("0 changes");
  });
});

describe("escaping", () => {
  it("turns every character that could be markup into text", () => {
    expect(escapeHtml("<a href=\"x\">&'")).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("the notice the report's tab shows first", () => {
  // the-sprint-report-reads-like-the-timeline. The tab is opened by the
  // click, before the request, and says what it is waiting for.

  it("is a whole document in the report's own look, with nothing to print", () => {
    const page = renderSprintReportNotice("Sprint summary", "Reading 12 changes. The report appears here when it is ready.");

    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain("<h1>Sprint summary</h1>");
    expect(page).toContain("Reading 12 changes.");
    expect(page).toContain("openspec-report-head");
    expect(page).not.toContain("window.print()");
  });

  it("carries a failure as text, not markup", () => {
    const page = renderSprintReportNotice("The sprint summary could not be made", "<script>alert(1)</script>");

    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

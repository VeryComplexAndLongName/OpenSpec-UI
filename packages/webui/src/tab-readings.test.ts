import { describe, expect, it } from "vitest";
import { OVERVIEW_READING, busyTabs, tabReadings, type ShellReadingState } from "./tab-readings.js";

const SETTLED: ShellReadingState = {
  overviewLoading: false,
  overviewRead: true,
  diffLoading: false,
  diffChangeName: "",
  editorLoading: false,
  editorChangeName: "",
  templatesLoading: false,
  timelineLoading: false,
  timelineSelection: "",
  comparisonLoading: false,
  sprintReportLoading: false,
  processesReading: null,
  harnessReading: null,
  pipelineReading: null,
};

function readingsWith(patch: Partial<ShellReadingState>) {
  return tabReadings({ ...SETTLED, ...patch });
}

// a-screen-says-what-it-is-doing 3.2: every row of design.md's table.
describe("tabReadings", () => {
  it("gives no tab a reading when the shell is settled", () => {
    expect(Object.values(tabReadings(SETTLED)).every((reading) => reading === null)).toBe(true);
    expect(busyTabs(tabReadings(SETTLED)).size).toBe(0);
  });

  it.each<[string, Partial<ShellReadingState>, string, string]>([
    ["the summary", { overviewLoading: true }, "overview", OVERVIEW_READING],
    ["a diff", { diffLoading: true, diffChangeName: "alpha" }, "diff-preview", "Reading the diff of alpha from git…"],
    ["a change in the editor", { editorLoading: true, editorChangeName: "alpha" }, "change-editor", "Reading alpha…"],
    ["the template catalog", { templatesLoading: true }, "templates", "Reading the template catalog…"],
    ["one change's timeline", { timelineLoading: true, timelineSelection: "archived:2026-09-14-alpha" }, "timeline", "Reading 2026-09-14-alpha's history from git…"],
    ["the comparison's dates", { comparisonLoading: true }, "timeline", "Reading when every change was proposed and archived…"],
    ["a sprint report", { sprintReportLoading: true }, "timeline", "Building the sprint report from git…"],
    ["the processes", { processesReading: "Reading persisted runs…" }, "processes", "Reading persisted runs…"],
    ["the harness settings", { harnessReading: "Saving the harness settings…" }, "harness-settings", "Saving the harness settings…"],
    ["the pipeline", { pipelineReading: "Reading what is running…" }, "pipeline", "Reading what is running…"],
  ])("names %s on its own tab, and on no other", (_label, patch, tab, sentence) => {
    const readings = readingsWith(patch);

    expect(readings[tab as keyof typeof readings]).toBe(sentence);
    expect([...busyTabs(readings)]).toEqual([tab]);
  });

  it("says the overview is being read on the tabs whose pickers wait for it, until it has returned once", () => {
    const first = readingsWith({ overviewLoading: true, overviewRead: false });
    expect(first["diff-preview"]).toBe(OVERVIEW_READING);
    expect(first["change-editor"]).toBe(OVERVIEW_READING);
    expect(first.timeline).toBe(OVERVIEW_READING);
    expect(first.templates).toBeNull();

    // A later reload leaves the pickers full, so only the summary reads.
    const reload = readingsWith({ overviewLoading: true, overviewRead: true });
    expect([...busyTabs(reload)]).toEqual(["overview"]);
  });

  it("prefers a tab's own reading to the overview's", () => {
    const readings = readingsWith({ overviewLoading: true, overviewRead: false, diffLoading: true, diffChangeName: "alpha" });

    expect(readings["diff-preview"]).toBe("Reading the diff of alpha from git…");
  });

  it("never reads on Run a Command, whatever else is outstanding", () => {
    const everything = readingsWith({
      overviewLoading: true,
      overviewRead: false,
      templatesLoading: true,
      processesReading: "Reading persisted runs…",
      harnessReading: "Reading the harness settings…",
      pipelineReading: "Reading what is running…",
    });

    expect(everything["run-a-command"]).toBeNull();
  });
});

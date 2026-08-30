import { describe, expect, it } from "vitest";
import type { ChangeSummary } from "../types.js";
import { filterChanges } from "./change-filter.js";

const changes: ChangeSummary[] = [
  { name: "execution-core", state: "implemented", completedTasks: 20, totalTasks: 20 },
  { name: "shared-ui", state: "in-progress", completedTasks: 4, totalTasks: 17 },
  { name: "vscode-extension", state: "draft", completedTasks: 0, totalTasks: 16 },
];

describe("filterChanges", () => {
  it("returns all changes for an empty query", () => {
    expect(filterChanges(changes, "")).toEqual(changes);
    expect(filterChanges(changes, "   ")).toEqual(changes);
  });

  it("matches by name, case-insensitively", () => {
    expect(filterChanges(changes, "SHARED")).toEqual([changes[1]]);
  });

  it("matches by status label", () => {
    expect(filterChanges(changes, "progress")).toEqual([changes[1]]);
    expect(filterChanges(changes, "draft")).toEqual([changes[2]]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterChanges(changes, "does-not-exist")).toEqual([]);
  });
});
